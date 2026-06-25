import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { message, context, userId, chatContext } = await req.json()

    if (!userId || !message) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    }

    // Buscar histórico das últimas 20 mensagens
    const { data: history } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', userId)
      .eq('context', chatContext || 'dfl')
      .order('created_at', { ascending: true })
      .limit(20)

    const conversationHistory = Array.isArray(history) ? history : []

    // Salvar mensagem do usuário
    await supabase.from('chat_history').insert({
      user_id: userId,
      context: chatContext || 'dfl',
      role: 'user',
      content: message,
    })

    // Verificar qual provedor está configurado
    const apiKey = req.headers.get('x-api-key') || ''
    const provider = req.headers.get('x-provider') || 'gemini'
    const model = req.headers.get('x-model') || 'gemini-2.0-flash'

    if (!apiKey.trim()) {
      return NextResponse.json({ error: 'Chave de API não configurada.' }, { status: 400 })
    }

    // Montar mensagens para a IA (histórico + nova pergunta)
    const systemPrompt = `Você é o assistente financeiro do DFL Finance. Dados do mês atual:\n${context}\n\nResponda de forma curta, objetiva e amigável. Considere o histórico da conversa se houver.`

    let responseContent = ''

    if (provider === 'openai') {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ]

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages }),
      })
      const data = await res.json()
      responseContent = data.choices?.[0]?.message?.content || 'Erro ao obter resposta.'
    } else {
      // Google Gemini
      const historyText = conversationHistory
        .map((m: any) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
        .join('\n')
      
      const fullPrompt = `Contexto financeiro:\n${context}\n\nHistórico da conversa:\n${historyText}\n\nNova pergunta: ${message}`

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          }),
        }
      )
      const data = await res.json()
      responseContent = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Erro ao obter resposta.'
    }

    // Salvar resposta da IA
    await supabase.from('chat_history').insert({
      user_id: userId,
      context: chatContext || 'dfl',
      role: 'model',
      content: responseContent,
    })

    return NextResponse.json({ success: true, message: responseContent })
  } catch (error: any) {
    console.error('Erro na API chat:', error)
    return NextResponse.json({ error: 'Erro ao processar mensagem.' }, { status: 500 })
  }
}