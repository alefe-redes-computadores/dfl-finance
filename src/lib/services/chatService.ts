// src/lib/services/chatService.ts
import { supabase } from '@/lib/supabase'
import type {
  FinancialInsight,
  FinancialIntelligenceSnapshot,
} from '@/lib/financial-intelligence'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface FinancialAssistantContext {
  context: string
  generatedAt: string
  snapshot:
    FinancialIntelligenceSnapshot
  insights: FinancialInsight[]
  suggestedQuestions: string[]
}

async function getAuthenticatedResponse(
  messages: ChatMessage[],
  financialContext:
    FinancialAssistantContext
) {
  const {
    data: { session },
  } =
    await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error(
      'Sessão expirada. Entre novamente.'
    )
  }

  const response =
    await fetch(
      '/api/assistant/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages,
          financialContext,
        }),
      }
    )

  if (!response.ok) {
    let message =
      'Não foi possível consultar o assistente.'

    try {
      const data =
        await response.json()

      if (
        typeof data?.error ===
        'string'
      ) {
        message = data.error
      }
    } catch {
      const text =
        await response.text()

      if (text.trim()) {
        message = text.trim()
      }
    }

    throw new Error(message)
  }

  return response
}

export async function streamChatMessage(
  messages: ChatMessage[],
  financialContext:
    FinancialAssistantContext,
  onUpdate?: (
    fullText: string
  ) => void
): Promise<string> {
  const response =
    await getAuthenticatedResponse(
      messages,
      financialContext
    )

  if (!response.body) {
    throw new Error(
      'O servidor não disponibilizou o fluxo da resposta.'
    )
  }

  const reader =
    response.body.getReader()

  const decoder =
    new TextDecoder()

  let fullText = ''

  while (true) {
    const {
      value,
      done,
    } =
      await reader.read()

    if (done) break

    fullText +=
      decoder.decode(
        value,
        {
          stream: true,
        }
      )

    onUpdate?.(fullText)
  }

  fullText +=
    decoder.decode()

  const normalized =
    fullText.trim()

  if (!normalized) {
    throw new Error(
      'O assistente retornou uma resposta vazia.'
    )
  }

  onUpdate?.(normalized)

  return normalized
}

export async function sendChatMessage(
  messages: ChatMessage[],
  financialContext:
    FinancialAssistantContext
): Promise<string> {
  return streamChatMessage(
    messages,
    financialContext
  )
}
