// src/app/api/extract-invoice/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

import {
  AI_MODEL,
  MAX_AI_FILE_BYTES,
  MAX_EXTRACTED_TRANSACTIONS,
  extractJsonArray,
  isAiTimeoutError,
  logServerFailure,
  normalizeAiText,
  normalizeCivilDate,
  normalizePositiveAmount,
  withAiTimeout,
} from '@/lib/server/aiSafety'

type ExtractedTransaction = {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  suggested_category?: string
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase não configurado no servidor.')
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function sanitizeTransactions(input: unknown): ExtractedTransaction[] {
  if (!Array.isArray(input)) return []

  return input
    .slice(0, MAX_EXTRACTED_TRANSACTIONS + 1)
    .flatMap((item: any) => {
      const date = normalizeCivilDate(item?.date)
      const description = normalizeAiText(item?.description, 200)
      const amount = normalizePositiveAmount(item?.amount)
      const type =
        item?.type === 'income'
          ? 'income'
          : item?.type === 'expense'
            ? 'expense'
            : null

      if (!date || !description || amount === null || !type) return []

      const suggestedCategory = normalizeAiText(item?.suggested_category, 80)

      return [
        {
          date,
          description,
          amount,
          type,
          ...(suggestedCategory
            ? { suggested_category: suggestedCategory }
            : {}),
        },
      ]
    })
}

function isPdfBuffer(buffer: Buffer) {
  return (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  )
}

function looksLikeOfx(text: string) {
  const header = text.slice(0, 16384).toUpperCase()
  return header.includes('OFXHEADER') || header.includes('<OFX')
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization')
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : ''

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Sessão não autenticada.' },
        { status: 401 }
      )
    }

    const supabase = getServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Sessão inválida ou expirada.' },
        { status: 401 }
      )
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        { error: 'Não foi possível ler o arquivo enviado.' },
        { status: 400 }
      )
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Arquivo obrigatório.' },
        { status: 400 }
      )
    }

    if (file.size <= 0 || file.size > MAX_AI_FILE_BYTES) {
      return NextResponse.json(
        { error: 'O arquivo deve ter no máximo 10 MB.' },
        { status: 400 }
      )
    }

    const lowerName = file.name.trim().toLowerCase()
    const isOfx = lowerName.endsWith('.ofx')
    const isPdf = lowerName.endsWith('.pdf')

    if (!isOfx && !isPdf) {
      return NextResponse.json(
        { error: 'Use um arquivo PDF ou OFX.' },
        { status: 400 }
      )
    }

    let transactions: ExtractedTransaction[] = []

    if (isOfx) {
      const ofxText = await file.text()

      if (!looksLikeOfx(ofxText)) {
        return NextResponse.json(
          { error: 'O arquivo OFX enviado não parece válido.' },
          { status: 400 }
        )
      }

      transactions = sanitizeTransactions(parseOFX(ofxText))
    } else {
      const apiKey = process.env.GEMINI_API_KEY

      if (!apiKey) {
        return NextResponse.json(
          { error: 'Serviço de leitura temporariamente indisponível.' },
          { status: 503 }
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      if (!isPdfBuffer(buffer)) {
        return NextResponse.json(
          { error: 'O arquivo enviado não é um PDF válido.' },
          { status: 400 }
        )
      }

      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: AI_MODEL })

      const prompt = `Extraia as movimentações financeiras deste documento.

Retorne EXCLUSIVAMENTE um array JSON válido, sem markdown.

Cada objeto deve conter:
- "date": string no formato "YYYY-MM-DD"
- "description": string curta e fiel ao lançamento
- "amount": number positivo
- "type": "income" para créditos/estornos e "expense" para compras/despesas
- "suggested_category": string curta quando houver uma categoria evidente; caso contrário, ""

Não invente lançamentos, datas ou valores.
Não retorne mais de ${MAX_EXTRACTED_TRANSACTIONS} lançamentos.`

      const result = await withAiTimeout(
        model.generateContent([
          {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: 'application/pdf',
            },
          },
          prompt,
        ])
      )

      const jsonText = extractJsonArray(result.response.text())
      if (!jsonText) {
        return NextResponse.json(
          { error: 'Não foi possível interpretar o documento.' },
          { status: 422 }
        )
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(jsonText)
      } catch {
        return NextResponse.json(
          { error: 'A leitura retornou dados inválidos.' },
          { status: 422 }
        )
      }

      if (
        Array.isArray(parsed) &&
        parsed.length > MAX_EXTRACTED_TRANSACTIONS
      ) {
        return NextResponse.json(
          { error: 'O documento possui movimentações demais para uma única importação.' },
          { status: 422 }
        )
      }

      transactions = sanitizeTransactions(parsed)
    }

    if (transactions.length > MAX_EXTRACTED_TRANSACTIONS) {
      return NextResponse.json(
        { error: 'O arquivo possui movimentações demais para uma única importação.' },
        { status: 422 }
      )
    }

    if (transactions.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma movimentação válida foi encontrada.' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      transactions,
      file_name: normalizeAiText(file.name, 180),
      file_type: isOfx ? 'ofx' : 'pdf',
    })
  } catch (error) {
    logServerFailure('extract-invoice', error)

    if (isAiTimeoutError(error)) {
      return NextResponse.json(
        { error: 'A leitura demorou mais que o esperado. Tente novamente.' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao processar o arquivo.' },
      { status: 500 }
    )
  }
}

function parseOFX(ofxText: string): ExtractedTransaction[] {
  const transactions: ExtractedTransaction[] = []
  const blockRegex =
    /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|$))/gi

  let match: RegExpExecArray | null

  while ((match = blockRegex.exec(ofxText)) !== null) {
    if (transactions.length > MAX_EXTRACTED_TRANSACTIONS) break

    const block = match[1]
    const dateMatch = block.match(/<DTPOSTED>(\d{8})/i)
    const amountMatch = block.match(/<TRNAMT>([-+]?\d+(?:[.,]\d+)?)/i)
    const memoMatch =
      block.match(/<MEMO>([^<\r\n]*)/i) ||
      block.match(/<NAME>([^<\r\n]*)/i)

    if (!dateMatch || !amountMatch) continue

    const rawAmount = Number(amountMatch[1].replace(',', '.'))
    if (!Number.isFinite(rawAmount) || rawAmount === 0) continue

    const rawDate = dateMatch[1]
    const date = normalizeCivilDate(
      `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
    )
    if (!date) continue

    transactions.push({
      date,
      description: normalizeAiText(memoMatch?.[1], 200) || 'Transação OFX',
      amount: Math.abs(rawAmount),
      type: rawAmount > 0 ? 'income' : 'expense',
    })
  }

  return transactions
}
