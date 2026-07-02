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

    if (!response.ok) {
      console.error('Erro na API do Google Vision:', response.status)
      return NextResponse.json({ error: 'Erro ao processar imagem' }, { status: 500 })
    }

    const data = await response.json()
    const fullText = data.responses?.[0]?.fullTextAnnotation?.text || ''

    if (!fullText.trim()) {
      return NextResponse.json({ 
        success: true, 
        data: { amount: null, date: null, description: null, rawText: '' } 
      })
    }

    const extracted = extractTransactionData(fullText)

    return NextResponse.json({ success: true, data: extracted })
  } catch (error) {
    console.error('Erro no OCR:', error)
    return NextResponse.json({ error: 'Erro ao processar imagem' }, { status: 500 })
  }
}

function extractTransactionData(text: string) {
  console.log('Texto extraído do OCR:', text)

  // ============================================================
  // EXTRAÇÃO DE VALOR (múltiplos padrões)
  // ============================================================
  let amount: string | null = null

  // Padrão 1: R$ 19,90 ou R$19,90
  const amountRegex1 = /R?\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/
  // Padrão 2: TOTAL 19,90 ou Total 19.90
  const amountRegex2 = /(?:TOTAL|Total|total)\s*:?\s*R?\$?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/
  // Padrão 3: apenas número com vírgula (ex: 19,90) no final de linhas
  const amountRegex3 = /(?:^|\s)(\d{1,3}(?:\.\d{3})*,\d{2})(?:\s|$)/

  const match1 = text.match(amountRegex2) || text.match(amountRegex1)
  if (match1) {
    amount = match1[1]
  } else {
    const match3 = text.match(amountRegex3)
    if (match3) {
      amount = match3[1]
    }
  }

  // ============================================================
  // EXTRAÇÃO DE DATA (múltiplos formatos)
  // ============================================================
  let date: string | null = null

  // Padrão 1: DD/MM/YYYY
  const dateRegex1 = /(\d{2}\/\d{2}\/\d{4})/
  // Padrão 2: DD.MM.YYYY
  const dateRegex2 = /(\d{2}\.\d{2}\.\d{4})/
  // Padrão 3: DD/MM/YY
  const dateRegex3 = /(\d{2}\/\d{2}\/\d{2})/

  const dateMatch = text.match(dateRegex1) || text.match(dateRegex2) || text.match(dateRegex3)
  if (dateMatch) {
    date = dateMatch[1]
    // Normaliza para DD/MM/YYYY
    if (date.includes('.')) {
      date = date.replace(/\./g, '/')
    }
  }

  // ============================================================
  // EXTRAÇÃO DE DESCRIÇÃO (estabelecimento)
  // ============================================================
  const lines = text.split('\n').filter((l: string) => l.trim())
  const description = lines[0]?.trim() || ''

  return {
    amount,
    date,
    description: description || null,
    rawText: text
  }
}