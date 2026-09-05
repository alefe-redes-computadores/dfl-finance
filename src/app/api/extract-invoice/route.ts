// src/app/api/extract-invoice/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

type ExtractedTransaction = {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  suggested_category?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

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

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }

  return `${match[1]}-${match[2]}-${match[3]}`
}

function sanitizeTransactions(input: unknown): ExtractedTransaction[] {
  if (!Array.isArray(input)) return []

  return input.flatMap((item: any) => {
    const date = normalizeDate(item?.date)
    const description =
      typeof item?.description === 'string'
        ? item.description.trim()
        : ''
    const amount = Math.abs(Number(item?.amount))
    const type =
      item?.type === 'income'
        ? 'income'
        : item?.type === 'expense'
          ? 'expense'
          : null

    if (
      !date ||
      !description ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !type
    ) {
      return []
    }

    const suggestedCategory =
      typeof item?.suggested_category === 'string'
        ? item.suggested_category.trim()
        : ''

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

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Arquivo obrigatório.' },
        { status: 400 }
      )
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'O arquivo deve ter no máximo 10 MB.' },
        { status: 400 }
      )
    }

    const lowerName = file.name.toLowerCase()
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
      transactions = sanitizeTransactions(
        parseOFX(await file.text())
      )
    } else {
      const apiKey = process.env.GEMINI_API_KEY

      if (!apiKey) {
        return NextResponse.json(
          { error: 'Gemini não configurado no servidor.' },
          { status: 503 }
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      })

      const prompt = `Extraia as movimentações financeiras deste documento.

Retorne EXCLUSIVAMENTE um array JSON válido, sem markdown.

Cada objeto deve conter:
- "date": string no formato "YYYY-MM-DD"
- "description": string curta e fiel ao lançamento
- "amount": number positivo
- "type": "income" para créditos/estornos e "expense" para compras/despesas
- "suggested_category": string curta quando houver uma categoria evidente; caso contrário, ""

Não invente lançamentos, datas ou valores.
Exemplo:
[{"date":"2026-06-15","description":"UBER TRIP","amount":25.5,"type":"expense","suggested_category":"Transporte"}]`

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

      if (!jsonMatch) {
        return NextResponse.json(
          { error: 'Não foi possível interpretar o documento.' },
          { status: 422 }
        )
      }

      let parsed: unknown

      try {
        parsed = JSON.parse(jsonMatch[0])
      } catch {
        return NextResponse.json(
          { error: 'A leitura retornou dados inválidos.' },
          { status: 422 }
        )
      }

      transactions = sanitizeTransactions(parsed)
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
      file_name: file.name,
      file_type: isOfx ? 'ofx' : 'pdf',
    })
  } catch (error: any) {
    console.error('Erro na extração da fatura:', error)

    return NextResponse.json(
      {
        error:
          error?.message ||
          'Erro ao processar o arquivo.',
      },
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
    const block = match[1]

    const dateMatch = block.match(/<DTPOSTED>(\d{8})/i)
    const amountMatch = block.match(/<TRNAMT>([-+]?\d+(?:[.,]\d+)?)/i)
    const memoMatch =
      block.match(/<MEMO>([^<\r\n]*)/i) ||
      block.match(/<NAME>([^<\r\n]*)/i)

    if (!dateMatch || !amountMatch) continue

    const rawAmount = Number(
      amountMatch[1].replace(',', '.')
    )

    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      continue
    }

    const rawDate = dateMatch[1]
    const date =
      `${rawDate.slice(0, 4)}-` +
      `${rawDate.slice(4, 6)}-` +
      `${rawDate.slice(6, 8)}`

    transactions.push({
      date,
      description:
        memoMatch?.[1]?.trim() || 'Transação OFX',
      amount: Math.abs(rawAmount),
      type: rawAmount > 0 ? 'income' : 'expense',
    })
  }

  return transactions
}
