import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ExtractedInvoiceData {
  amount: number | null
  date: string | null
  description: string | null
  suggested_category: string
}

// Converte ArrayBuffer para Base64 de forma compatível com Navegadores/Capacitor (Sem usar 'Buffer')
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Extrai apenas a parte Base64, ignorando o cabeçalho 'data:image/jpeg;base64,'
      const base64Data = result.includes(',') ? result.split(',')[1] : result
      resolve(base64Data)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const OCR_PROMPT = `Analise esta imagem de comprovante fiscal ou cupom e extraia as seguintes informações:
- Valor total (number)
- Data (string no formato "YYYY-MM-DD")
- Descrição do estabelecimento (string)
- Categoria sugerida (string, uma destas: "Alimentação", "Transporte", "Moradia", "Lazer", "Saúde", "Educação", "Assinaturas", "Outros")

Retorne EXCLUSIVAMENTE um JSON válido no formato exato:
{
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "description": "",
  "suggested_category": ""
}

Se não conseguir identificar alguma informação, use null para os campos de texto e 0 para o valor.`

export async function extractInvoiceFromImage(
  imageUrl: string,
  apiKey: string
): Promise<ExtractedInvoiceData> {
  try {
    if (!apiKey) throw new Error('Chave de API do Gemini não configurada.')

    const imageResponse = await fetch(imageUrl)
    if (!imageResponse.ok) throw new Error('Não foi possível acessar a imagem.')

    const imageBuffer = await imageResponse.arrayBuffer()
    const base64Image = arrayBufferToBase64(imageBuffer) // 🔥 Correção do erro de Buffer
    const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

    const result = await model.generateContent([
      { inlineData: { data: base64Image, mimeType } },
      OCR_PROMPT,
    ])

    return parseGeminiResponse(result.response.text())
  } catch (error: any) {
    console.error('Erro no OCR por URL:', error)
    throw new Error(error.message || 'Erro ao processar imagem da URL.')
  }
}

export async function extractReceiptFromFile(
  file: File,
  apiKey: string
): Promise<ExtractedInvoiceData> {
  try {
    if (!apiKey) throw new Error('Chave de API do Gemini não configurada.')

    const base64Image = await fileToBase64(file)
    const mimeType = file.type || 'image/jpeg'

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

    const result = await model.generateContent([
      { inlineData: { data: base64Image, mimeType } },
      OCR_PROMPT,
    ])

    return parseGeminiResponse(result.response.text())
  } catch (error: any) {
    console.error('Erro na extração de arquivo:', error)
    throw new Error(error.message || 'Erro ao processar a foto do comprovante.')
  }
}

// Função auxiliar para evitar repetição de código e tratar erros no JSON
function parseGeminiResponse(text: string): ExtractedInvoiceData {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  
  if (!jsonMatch) {
    throw new Error('Formato de resposta da IA inválido. Tente tirar a foto novamente.')
  }

  try {
    const data = JSON.parse(jsonMatch[0])
    return {
      amount: data.amount || null,
      date: data.date || null,
      description: data.description || null,
      suggested_category: data.suggested_category || 'Outros',
    }
  } catch (err) {
    throw new Error('Falha ao ler os dados do recibo. A imagem pode estar embaçada.')
  }
}
