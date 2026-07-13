import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave de API não fornecida. Configure sua chave nas configurações.' },
        { status: 400 }
      )
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Mensagens inválidas.' },
        { status: 400 }
      )
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: messages.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
          })),
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Erro da API Gemini:', data)

      // Tratamento de erro de quota
      if (response.status === 429 || data?.error?.message?.includes('quota') || data?.error?.message?.includes('limit')) {
        return NextResponse.json(
          { error: 'Erro de conexão com o servidor de IA. Verifique sua chave de API ou tente novamente mais tarde.' },
          { status: 429 }
        )
      }

      return NextResponse.json(
        { error: data?.error?.message || 'Erro ao processar requisição.' },
        { status: response.status }
      )
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      return NextResponse.json(
        { error: 'Resposta vazia da IA. Tente reformular sua pergunta.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ text })
  } catch (error: any) {
    console.error('Erro no servidor:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor. Tente novamente.' },
      { status: 500 }
    )
  }
}