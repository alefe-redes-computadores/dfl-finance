// src/app/api/ocr-receipt/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Supabase não configurado no servidor.')
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
}

function validateReceiptUrl(rawUrl: unknown) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) throw new Error('URL da imagem é obrigatória.')
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) throw new Error('Supabase não configurado no servidor.')
  let candidate: URL
  let allowedOrigin: string
  try {
    candidate = new URL(rawUrl)
    allowedOrigin = new URL(supabaseUrl).origin
  } catch {
    throw new Error('URL da imagem inválida.')
  }
  if (candidate.origin !== allowedOrigin) throw new Error('A imagem precisa pertencer ao armazenamento do DFL Finance.')
  const receiptPrefix = '/storage/v1/object/public/receipts/'
  if (!candidate.pathname.startsWith(receiptPrefix)) throw new Error('A imagem precisa pertencer ao bucket de comprovantes.')
  return candidate.toString()
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization')
    const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (!accessToken) return NextResponse.json({ error: 'Sessão não autenticada.' }, { status: 401 })

    const supabase = getSupabaseAuthClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 })

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Gemini não configurado no servidor.' }, { status: 503 })

    const body = await request.json()
    let imageUrl: string
    try {
      imageUrl = validateReceiptUrl(body?.imageUrl)
    } catch (error: any) {
      return NextResponse.json({ error: error?.message || 'Imagem inválida.' }, { status: 400 })
    }

    const imageResponse = await fetch(imageUrl, { redirect: 'error' })
    if (!imageResponse.ok) return NextResponse.json({ error: 'Não foi possível acessar a imagem.' }, { status: 400 })

    const contentLength = Number(imageResponse.headers.get('content-length') || 0)
    const maxBytes = 10 * 1024 * 1024
    if (contentLength > 0 && contentLength > maxBytes) return NextResponse.json({ error: 'A imagem excede o limite de 10 MB.' }, { status: 413 })

    const mimeType = imageResponse.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    if (!mimeType.startsWith('image/')) return NextResponse.json({ error: 'O arquivo enviado não é uma imagem válida.' }, { status: 400 })

    const imageBuffer = await imageResponse.arrayBuffer()
    if (imageBuffer.byteLength > maxBytes) return NextResponse.json({ error: 'A imagem excede o limite de 10 MB.' }, { status: 413 })

    const base64Image = Buffer.from(imageBuffer).toString('base64')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

    const prompt = `Analise esta imagem de comprovante fiscal ou cupom e extraia:
- Valor total como número
- Data no formato YYYY-MM-DD
- Descrição do estabelecimento
- Categoria sugerida entre: Alimentação, Transporte, Moradia, Lazer, Saúde, Educação, Assinaturas, Outros

Retorne exclusivamente JSON válido:
{
  "amount": 0,
  "date": "",
  "description": "",
  "suggested_category": ""
}

Se não identificar um texto, use null. Para valor não identificado, use 0.`

    const result = await model.generateContent([{ inlineData: { data: base64Image, mimeType } }, prompt])
    const text = result.response.text().trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Não foi possível extrair os dados do comprovante.' }, { status: 422 })

    let parsed: any
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ error: 'A leitura do comprovante retornou dados inválidos.' }, { status: 422 })
    }

    const amount = Number(parsed?.amount)
    return NextResponse.json({
      success: true,
      data: {
        amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
        date: typeof parsed?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
        description: typeof parsed?.description === 'string' && parsed.description.trim() ? parsed.description.trim().slice(0, 200) : null,
        suggested_category: typeof parsed?.suggested_category === 'string' && parsed.suggested_category.trim() ? parsed.suggested_category.trim().slice(0, 80) : 'Outros',
      },
    })
  } catch (error: any) {
    console.error('Erro no OCR de comprovante:', error)
    return NextResponse.json({ error: error?.message || 'Erro ao processar imagem.' }, { status: 500 })
  }
}
