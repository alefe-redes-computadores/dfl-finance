// src/app/api/ocr-receipt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

import {
  AI_MODEL,
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_AI_FILE_BYTES,
  extractJsonObject,
  fetchWithTimeout,
  isAiTimeoutError,
  logServerFailure,
  normalizeAiText,
  normalizeCivilDate,
  normalizePositiveAmount,
  normalizeReceiptCategory,
  withAiTimeout,
} from '@/lib/server/aiSafety'

function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase não configurado no servidor.')
  }

  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function validateReceiptUrl(rawUrl: unknown) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw new Error('URL da imagem é obrigatória.')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    throw new Error('Supabase não configurado no servidor.')
  }

  let candidate: URL
  let allowedOrigin: string

  try {
    candidate = new URL(rawUrl)
    allowedOrigin = new URL(supabaseUrl).origin
  } catch {
    throw new Error('URL da imagem inválida.')
  }

  if (candidate.origin !== allowedOrigin) {
    throw new Error('A imagem precisa pertencer ao armazenamento do DFL Finance.')
  }

  const receiptPrefix = '/storage/v1/object/public/receipts/'
  let decodedPath: string

  try {
    decodedPath = decodeURIComponent(candidate.pathname)
  } catch {
    throw new Error('URL da imagem inválida.')
  }

  if (
    !candidate.pathname.startsWith(receiptPrefix) ||
    !decodedPath.startsWith(receiptPrefix) ||
    decodedPath.includes('/../')
  ) {
    throw new Error('A imagem precisa pertencer ao bucket de comprovantes.')
  }

  return candidate.toString()
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

    const supabase = getSupabaseAuthClient()
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

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Serviço de leitura temporariamente indisponível.' },
        { status: 503 }
      )
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Corpo da requisição inválido.' },
        { status: 400 }
      )
    }

    let imageUrl: string
    try {
      imageUrl = validateReceiptUrl(body?.imageUrl)
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Imagem inválida.',
        },
        { status: 400 }
      )
    }

    let imageResponse: Response
    try {
      imageResponse = await fetchWithTimeout(imageUrl, {
        redirect: 'error',
        cache: 'no-store',
      })
    } catch {
      return NextResponse.json(
        { error: 'Não foi possível acessar a imagem.' },
        { status: 400 }
      )
    }

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Não foi possível acessar a imagem.' },
        { status: 400 }
      )
    }

    const contentLength = Number(
      imageResponse.headers.get('content-length') || 0
    )

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_AI_FILE_BYTES
    ) {
      return NextResponse.json(
        { error: 'A imagem excede o limite de 10 MB.' },
        { status: 413 }
      )
    }

    const mimeType =
      imageResponse.headers
        .get('content-type')
        ?.split(';')[0]
        ?.trim()
        ?.toLowerCase() || ''

    if (!ALLOWED_RECEIPT_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: 'Formato de imagem não suportado. Use JPEG, PNG, WebP, HEIC ou HEIF.' },
        { status: 400 }
      )
    }

    const imageBuffer = await imageResponse.arrayBuffer()

    if (imageBuffer.byteLength <= 0) {
      return NextResponse.json(
        { error: 'A imagem está vazia.' },
        { status: 400 }
      )
    }

    if (imageBuffer.byteLength > MAX_AI_FILE_BYTES) {
      return NextResponse.json(
        { error: 'A imagem excede o limite de 10 MB.' },
        { status: 413 }
      )
    }

    const base64Image = Buffer.from(imageBuffer).toString('base64')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: AI_MODEL })

    const prompt = `Analise esta imagem de comprovante fiscal ou cupom e extraia:
- Valor total como número
- Data civil válida no formato YYYY-MM-DD
- Descrição curta do estabelecimento
- Categoria sugerida entre: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Assinaturas, Outros

Retorne exclusivamente JSON válido:
{
  "amount": 0,
  "date": "",
  "description": "",
  "suggested_category": ""
}

Não invente dados ausentes.
Se não identificar um texto, use null. Para valor não identificado, use 0.`

    const result = await withAiTimeout(
      model.generateContent([
        { inlineData: { data: base64Image, mimeType } },
        prompt,
      ])
    )

    const jsonText = extractJsonObject(result.response.text().trim())
    if (!jsonText) {
      return NextResponse.json(
        { error: 'Não foi possível extrair os dados do comprovante.' },
        { status: 422 }
      )
    }

    let parsed: any
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      return NextResponse.json(
        { error: 'A leitura do comprovante retornou dados inválidos.' },
        { status: 422 }
      )
    }

    const amount = normalizePositiveAmount(parsed?.amount)
    const date = normalizeCivilDate(parsed?.date)
    const description = normalizeAiText(parsed?.description, 200)

    return NextResponse.json({
      success: true,
      data: {
        amount: amount ?? 0,
        date,
        description: description || null,
        suggested_category: normalizeReceiptCategory(parsed?.suggested_category),
      },
    })
  } catch (error) {
    logServerFailure('ocr-receipt', error)

    if (isAiTimeoutError(error)) {
      return NextResponse.json(
        { error: 'A leitura demorou mais que o esperado. Tente novamente.' },
        { status: 504 }
      )
    }

    return NextResponse.json(
      { error: 'Erro ao processar imagem.' },
      { status: 500 }
    )
  }
}
