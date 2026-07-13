import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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
    let transactions: any[] = []

    // Extração
    if (fileType === 'ofx') {
      const ofxText = await file.text()
      transactions = parseOFX(ofxText)
    } else {
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

    // Conciliação via função SQL
    let reconciliationResult = { new: transactions, review: [], duplicates: [] }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && transactions.length > 0) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Chama a função de conciliação
      const { data, error } = await supabase.rpc('reconcile_imported_transactions', {
        p_user_id: userId,
        p_context: context,
        p_imported_json: JSON.stringify(transactions),
      })

      if (!error && data) {
        reconciliationResult = data as any
      }

      // Registra a importação
      await supabase.from('invoice_imports').insert({
        user_id: userId,
        context,
        file_name: file.name,
        file_type: fileType,
        transactions_imported: transactions.length,
        raw_response: JSON.stringify(reconciliationResult),
      })
    }

    return NextResponse.json({
      success: true,
      ...reconciliationResult,
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

function parseOFX(ofxText: string): any[] {
  const transactions: any[] = []
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