import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'URL da imagem é obrigatória.' }, { status: 400 })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Analise esta imagem de comprovante fiscal ou cupom e extraia as seguintes informações:
- Valor total (number)
- Data (string no formato "YYYY-MM-DD")
- Descrição do estabelecimento (string)
- Categoria sugerida (string, uma destas: "Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Educação", "Assinaturas", "Outros")

Retorne EXCLUSIVAMENTE um JSON válido no formato:
{
  "amount": 0,
  "date": "",
  "description": "",
  "suggested_category": ""
}

Se não conseguir identificar alguma informação, use null para os campos de texto e 0 para o valor.`

    // Busca a imagem como base64 a partir da URL
    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Não foi possível acessar a imagem.' }, { status: 400 })
    }
    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      },
      prompt,
    ])

    const response = result.response
    const text = response.text()

    // Extrai o JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0])
      return NextResponse.json({
        success: true,
        data: {
          amount: data.amount || 0,
          date: data.date || null,
          description: data.description || null,
          suggested_category: data.suggested_category || 'Outros',
        },
      })
    }

    return NextResponse.json({ error: 'Não foi possível extrair os dados do comprovante.' }, { status: 422 })
  } catch (error: any) {
    console.error('Erro no OCR:', error)
    return NextResponse.json({ error: `Erro ao processar imagem: ${error.message}` }, { status: 500 })
  }
}
