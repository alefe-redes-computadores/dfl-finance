import { GoogleGenerativeAI } from '@google/generative-ai'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function sendChatMessage(
  messages: ChatMessage[],
  apiKey: string
): Promise<string> {
  try {
    if (!apiKey) {
      throw new Error('Chave de API do Gemini não configurada. Adicione nas configurações.')
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const formattedMessages = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }))

    const result = await model.generateContent({
      contents: formattedMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    })

    const response = result.response
    const text = response.text()

    if (!text) {
      throw new Error('Resposta vazia da IA. Tente reformular sua pergunta.')
    }

    return text
  } catch (error: any) {
    console.error('Erro no Chat:', error)
    throw new Error(
      error.message || 'Erro ao conectar com a IA. Verifique sua chave de API.'
    )
  }
}
