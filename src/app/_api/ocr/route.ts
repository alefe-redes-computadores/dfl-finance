import { NextRequest, NextResponse } from 'next/server'

/**
 * Extrai dados estruturados do texto OCR
 */
function extractTransactionData(text: string) {
  console.log('📄 Texto extraído do OCR:', text.slice(0, 300))

  // ============================================================
  // EXTRAÇÃO DE VALOR
  // ============================================================
  let amount: number | null = null

  // Padrão 1: R$ 19,90 ou R$19,90 ou R$ 19.90
  const amountPatterns = [
    /(?:TOTAL|Total|total|VALOR\s+A\s+PAGAR|Valor\s+a\s+pagar|VALOR\s+TOTAL|Valor\s+Total)\s*:?\s*R?\$?\s*([\d.,]+)/i,
    /R?\$\s*([\d.,]+)/,
    /([\d.,]+)\s*R?\$?/,
  ]

  // Encontra o maior valor possível (evita pegar valores pequenos como 0,50)
  let maxValue = 0
  for (const pattern of amountPatterns) {
    const matches = text.match(new RegExp(pattern, 'g'))
    if (matches) {
      for (const match of matches) {
        const numStr = match.replace(/[R$\s:]/g, '').replace(',', '.').trim()
        const num = parseFloat(numStr)
        if (!isNaN(num) && num > maxValue && num < 100000) {
          maxValue = num
        }
      }
    }
  }

  // Se encontrou algum valor, usa ele
  if (maxValue > 0) {
    amount = parseFloat(maxValue.toFixed(2))
  }

  // Fallback: procura por números que parecem valores (ex: 19,90 ou 19.90)
  if (!amount) {
    const fallbackMatch = text.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/)
    if (fallbackMatch) {
      const num = parseFloat(fallbackMatch[1].replace(',', '.'))
      if (!isNaN(num) && num > 1) {
        amount = num
      }
    }
  }

  // ============================================================
  // EXTRAÇÃO DE DATA
  // ============================================================
  let date: string | null = null

  const datePatterns = [
    /(\d{2})\/(\d{2})\/(\d{4})/,           // DD/MM/YYYY
    /(\d{2})-(\d{2})-(\d{4})/,             // DD-MM-YYYY
    /(\d{2})\.(\d{2})\.(\d{4})/,           // DD.MM.YYYY
    /(\d{4})-(\d{2})-(\d{2})/,             // YYYY-MM-DD
  ]

  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      // Tenta interpretar como DD/MM/YYYY
      if (match[1].length === 4) {
        // Já é YYYY-MM-DD
        date = `${match[1]}-${match[2]}-${match[3]}`
      } else {
        // DD/MM/YYYY
        const day = match[1].padStart(2, '0')
        const month = match[2].padStart(2, '0')
        const year = match[3]
        date = `${year}-${month}-${day}`
      }
      break
    }
  }

  // ============================================================
  // EXTRAÇÃO DE DESCRIÇÃO (Estabelecimento)
  // ============================================================
  let description: string | null = null

  const lines = text.split('\n').filter((l: string) => l.trim().length > 0)
  
  // Pega a primeira linha que não seja muito curta (ignora cabeçalhos)
  for (const line of lines) {
    const trimmed = line.trim()
    // Ignora linhas que parecem números, datas ou são muito curtas
    if (
      trimmed.length > 3 &&
      !/^[\d\s\/.,:-]+$/.test(trimmed) &&
      !/^(R\$|Total|Data|Item|Produto|Qtd|Preço|Valor|CNPJ|CPF)/i.test(trimmed)
    ) {
      description = trimmed
      break
    }
  }

  // Se não encontrou, tenta a segunda linha
  if (!description && lines.length > 1) {
    description = lines[1]?.trim() || null
  }

  // ============================================================
  // RESULTADO
  // ============================================================
  return {
    amount,
    date,
    description,
    rawText: text,
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Validação: arquivo presente
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado. Campo "file" é obrigatório.' },
        { status: 400 }
      )
    }

    // 2. Validação: tipo de arquivo (imagem)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo de arquivo não suportado. Use: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // 3. Verifica se a chave da API está configurada
    const VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY
    if (!VISION_API_KEY) {
      console.error('❌ GOOGLE_VISION_API_KEY não configurada no .env.local')
      return NextResponse.json(
        { error: 'API Key do Google Vision não configurada.' },
        { status: 500 }
      )
    }

    // 4. Converte o arquivo para Base64 (sem prefixo)
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    // 5. Chama a API do Google Cloud Vision
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
            },
          ],
        }),
      }
    )

    // 6. Processa a resposta da Vision
    if (!visionResponse.ok) {
      const errorText = await visionResponse.text()
      console.error('❌ Erro na API do Google Vision:', visionResponse.status, errorText)
      return NextResponse.json(
        { error: `Erro no Google Vision: ${visionResponse.status}` },
        { status: 500 }
      )
    }

    const visionData = await visionResponse.json()
    const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text || ''

    if (!fullText.trim()) {
      return NextResponse.json({
        success: true,
        data: {
          amount: null,
          date: null,
          description: null,
          rawText: '',
        },
      })
    }

    // 7. Extrai dados estruturados do texto
    const extractedData = extractTransactionData(fullText)

    console.log('✅ OCR concluído com sucesso:', extractedData)

    // 8. Retorna os dados extraídos
    return NextResponse.json({
      success: true,
      data: extractedData,
    })
  } catch (error: any) {
    console.error('❌ Erro no OCR:', error)
    return NextResponse.json(
      { error: `Erro ao processar imagem: ${error.message || 'Erro interno'}` },
      { status: 500 }
    )
  }
}