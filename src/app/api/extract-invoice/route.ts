import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

interface ExtractedTransaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
}

interface ReviewSuggestion {
  imported: ExtractedTransaction
  matched: {
    id: string
    description: string
    amount: number
    date: string
    similarity: number
  }
  score: number
}

function similarity(a: string, b: string): number {
  const aLower = a.toLowerCase().replace(/[^a-z0-9 ]/g, '')
  const bLower = b.toLowerCase().replace(/[^a-z0-9 ]/g, '')

  if (aLower === bLower) return 1.0

  const maxLen = Math.max(aLower.length, bLower.length)
  if (maxLen === 0) return 1.0

  const dp: number[][] = Array(aLower.length + 1)
    .fill(null)
    .map(() => Array(bLower.length + 1).fill(0))

  for (let i = 0; i <= aLower.length; i++) dp[i][0] = i
  for (let j = 0; j <= bLower.length; j++) dp[0][j] = j

  for (let i = 1; i <= aLower.length; i++) {
    for (let j = 1; j <= bLower.length; j++) {
      dp[i][j] =
        aLower[i - 1] === bLower[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }

  const distance = dp[aLower.length][bLower.length]
  return 1 - distance / maxLen
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const userId = formData.get('user_id') as string
    const context = (formData.get('context') as string) || 'pf'
    const sourceType = (formData.get('sourceType') as string) || 'bank_statement'

    if (!file || !userId) {
      return NextResponse.json({ error: 'Arquivo e user_id são obrigatórios.' }, { status: 400 })
    }

    const fileType = file.name.toLowerCase().endsWith('.ofx') ? 'ofx' : 'pdf'
    let transactions: ExtractedTransaction[] = []

    if (fileType === 'ofx') {
      const ofxText = await file.text()
      transactions = parseOFX(ofxText)
    } else {
      // PDF: usar buffer base64 para Gemini
      const buffer = Buffer.from(await file.arrayBuffer())
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
      
      const prompt = `Extraia todas as transações financeiras deste documento e retorne EXCLUSIVAMENTE um array JSON válido. Cada objeto deve conter:
- "date": string no formato "YYYY-MM-DD"
- "description": string com o nome do estabelecimento
- "amount": number (sempre positivo)
- "type": "income" ou "expense"

Exemplo: [{"date": "2026-06-15", "description": "UBER TRIP", "amount": 25.50, "type": "expense"}]

IMPORTANTE: Retorne apenas o JSON puro, sem marcação de código.`

      const result = await model.generateContent([
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        },
        prompt,
      ])

      const text = result.response.text()
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        transactions = JSON.parse(jsonMatch[0])
      } else {
        return NextResponse.json({ error: 'Não foi possível extrair transações do documento.' }, { status: 422 })
      }
    }

    // --- ETAPA DE CONCILIAÇÃO ---
    // Busca transações existentes do usuário
    let existingTransactions: any[] = []

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      // Registra a importação
      await supabase.from('invoice_imports').insert({
        user_id: userId,
        context,
        file_name: file.name,
        file_type: fileType,
        transactions_imported: transactions.length,
        raw_response: JSON.stringify(transactions),
      })

      // Busca transações existentes para conciliação
      const { data } = await supabase
        .from('transactions')
        .select('id, amount, date, description')
        .eq('user_id', userId)
        .eq('context', context)
      existingTransactions = data || []
    }

    const newTrans: ExtractedTransaction[] = []
    const review: ReviewSuggestion[] = []
    const duplicates: ExtractedTransaction[] = []

    for (const imported of transactions) {
      let bestMatch: any = null
      let bestScore = 0

      for (const existing of existingTransactions) {
        if (Math.abs(existing.amount - imported.amount) > 0.01) continue

        const importedDate = new Date(imported.date)
        const existingDate = new Date(existing.date)
        const diffDays = Math.abs(importedDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24)
        if (diffDays > 2) continue

        const textSimilarity = similarity(imported.description, existing.description)
        const totalScore = 0.5 + Math.max(0, 1 - diffDays / 2) * 0.3 + textSimilarity * 0.2

        if (totalScore > bestScore) {
          bestScore = totalScore
          bestMatch = existing
        }
      }

      if (bestMatch && bestScore >= 0.95) {
        duplicates.push(imported)
      } else if (bestMatch && bestScore >= 0.8) {
        review.push({
          imported,
          matched: {
            id: bestMatch.id,
            description: bestMatch.description,
            amount: bestMatch.amount,
            date: bestMatch.date,
            similarity: bestScore,
          },
          score: bestScore,
        })
      } else {
        newTrans.push(imported)
      }
    }

    return NextResponse.json({
      success: true,
      new: newTrans,
      review,
      duplicates,
      file_name: file.name,
      file_type: fileType,
    })
  } catch (error: any) {
    console.error('Erro na extração:', error)
    return NextResponse.json(
      { error: `Erro ao processar arquivo: ${error.message}` },
      { status: 500 }
    )
  }
}

function parseOFX(ofxText: string): ExtractedTransaction[] {
  const transactions: ExtractedTransaction[] = []
  const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g
  let match

  while ((match = stmttrnRegex.exec(ofxText)) !== null) {
    const block = match[1]
    
    const dateMatch = block.match(/<DTPOSTED>(\d{8})/)
    const descriptionMatch = block.match(/<MEMO>(.*?)<\/MEMO>/) || block.match(/<NAME>(.*?)<\/NAME>/)
    const amountMatch = block.match(/<TRNAMT>([-\d.,]+)/)
    
    if (dateMatch && amountMatch) {
      const dateStr = dateMatch[1]
      const date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
      const amount = parseFloat(amountMatch[1].replace(',', '.'))
      const description = descriptionMatch?.[1]?.trim() || 'Transação OFX'
      
      transactions.push({
        date,
        description,
        amount: Math.abs(amount),
        type: amount > 0 ? 'income' : 'expense',
      })
    }
  }

  return transactions
}