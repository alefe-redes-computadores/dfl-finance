import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '')

function fileToGenerativePart(buffer: Buffer, mimeType: string) {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType,
    },
  }
}

// ============================================================
// FALLBACK: Extração manual com regex (caso o Gemini falhe)
// ============================================================
function extractTransactionData(text: string) {
  console.log('🔍 Fallback OCR (regex):', text.slice(0, 200))

  let amount: string | null = null
  const amountRegex1 = /R?\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/
  const amountRegex2 = /(?:TOTAL|Total|total)\s*:?\s*R?\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/
  const amountRegex3 = /(?:^|\s)(\d{1,3}(?:\.\d{3})*,\d{2})(?:\s|$)/

  const match1 = text.match(amountRegex2) || text.match(amountRegex1)
  if (match1) {
    amount = match1[1]
  } else {
    const match3 = text.match(amountRegex3)
    if (match3) amount = match3[1]
  }

  let date: string | null = null
  const dateRegex1 = /(\d{2}\/\d{2}\/\d{4})/
  const dateRegex2 = /(\d{2}\.\d{2}\.\d{4})/
  const dateRegex3 = /(\d{2}\/\d{2}\/\d{2})/

  const dateMatch = text.match(dateRegex1) || text.match(dateRegex2) || text.match(dateRegex3)
  if (dateMatch) {
    date = dateMatch[1].replace(/\./g, '/')
  }

  const lines = text.split('\n').filter((l: string) => l.trim())
  const description = lines[0]?.trim() || ''

  return { amount, date, description: description || null, rawText: text }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // ============================================================
    // 🔥 PRIORIDADE: GEMINI VISION
    // ============================================================
    let geminiSuccess = false
    let resultData = { amount: null, date: null, description: null, rawText: '' }

    if (GEMINI_API_KEY) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        const prompt = `
          Você é um especialista em extração de dados de cupons fiscais e recibos.
          Analise a imagem e retorne SOMENTE um JSON válido com:
          {
            "amount": 150.50,
            "date": "2025-07-06",
            "description": "Supermercado Extra"
          }
          Se não encontrar algum campo, retorne null.
        `

        const result = await model.generateContent([
          prompt,
          fileToGenerativePart(buffer, file.type),
        ])

        const response = await result.response
        const text = response.text()

        let cleanText = text.trim().replace(/```json\s*/g, '').replace(/```\s*/g, '')
        const parsed = JSON.parse(cleanText)

        resultData = {
          amount: parsed.amount || null,
          date: parsed.date || null,
          description: parsed.description || null,
          rawText: text,
        }

        geminiSuccess = true
        console.log('✅ Gemini OCR concluído com sucesso:', resultData)
      } catch (geminiError) {
        console.error('⚠️ Gemini falhou, usando fallback:', geminiError)
      }
    } else {
      console.warn('⚠️ GEMINI_API_KEY não configurada. Usando fallback.')
    }

    // ============================================================
    // 🔄 FALLBACK: Google Vision (mantido)
    // ============================================================
    if (!geminiSuccess) {
      const base64 = buffer.toString('base64')

      const visionResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64 },
              features: [{ type: 'TEXT_DETECTION' }]
            }]
          })
        }
      )

      if (visionResponse.ok) {
        const visionData = await visionResponse.json()
        const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text || ''
        resultData = extractTransactionData(fullText)
        console.log('✅ Vision OCR (fallback) concluído:', resultData)
      } else {
        console.error('❌ Vision também falhou:', visionResponse.status)
        // Último recurso: tenta o regex direto (já feito no extractTransactionData)
      }
    }

    return NextResponse.json({ success: true, data: resultData })
  } catch (error) {
    console.error('❌ Erro no OCR:', error)
    return NextResponse.json({ error: 'Erro ao processar imagem' }, { status: 500 })
  }
}