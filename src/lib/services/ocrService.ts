import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ExtractedInvoiceData {
  amount: number | null
  date: string | null
  description: string | null
  suggested_category: string
}

export async function extractInvoiceFromImage(
  imageUrl: string,
  apiKey: string
): Promise<ExtractedInvoiceData> {
  try {
    if (!apiKey) {
      throw new Error('Chave de API do Gemini não configurada.')
    }

    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) {
      throw new Error('Não foi possível acessar a imagem.')
    }

    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = Buffer.from(imageBuffer).toString('base64')
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'

    const genAI = new GoogleGenerativeAI(apiKey)
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

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      },
      prompt,
    ])

    const responseText = result.response.text()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Não foi possível extrair os dados do comprovante.')
    }

    const data = JSON.parse(jsonMatch[0])

    return {
      amount: data.amount || null,
      date: data.date || null,
      description: data.description || null,
      suggested_category: data.suggested_category || 'Outros',
    }
  } catch (error: any) {
    console.error('Erro no OCR:', error)
    throw new Error(error.message || 'Erro ao processar imagem.')
  }
}

export async function extractReceiptFromFile(
  file: File,
  apiKey: string
): Promise<ExtractedInvoiceData> {
  try {
    if (!apiKey) {
      throw new Error('Chave de API do Gemini não configurada.')
    }

    const base64Image = await fileToBase64(file)
    const mimeType = file.type || 'image/jpeg'

    const genAI = new GoogleGenerativeAI(apiKey)
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

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Image.split(',')[1],
          mimeType,
        },
      },
      prompt,
    ])

    const responseText = result.response.text()
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      throw new Error('Não foi possível extrair os dados do comprovante.')
    }

    const data = JSON.parse(jsonMatch[0])

    return {
      amount: data.amount || null,
      date: data.date || null,
      description: data.description || null,
      suggested_category: data.suggested_category || 'Outros',
    }
  } catch (error: any) {
    console.error('Erro na extração:', error)
    throw new Error(error.message || 'Erro ao processar imagem.')
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}