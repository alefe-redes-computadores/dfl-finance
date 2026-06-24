import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const response = await fetch(
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

    const data = await response.json()
    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || ''

    const extracted = extractTransactionData(fullText)

    return NextResponse.json({ success: true, data: extracted })
  } catch (error) {
    console.error('Erro no OCR:', error)
    return NextResponse.json({ error: 'Erro ao processar imagem' }, { status: 500 })
  }
}

function extractTransactionData(text: string) {
  const amountRegex = /R?\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/
  const amountMatch = text.match(amountRegex)
  
  const dateRegex = /(\d{2}\/\d{2}\/\d{4})/
  const dateMatch = text.match(dateRegex)

  const lines = text.split('\n').filter((l: string) => l.trim())
  const description = lines[0]?.trim() || ''

  return {
    amount: amountMatch ? amountMatch[1] : null,
    date: dateMatch ? dateMatch[1] : null,
    description: description || null,
    rawText: text
  }
}
