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

const ASSISTANT_REQUEST_TIMEOUT_MS = 25000
const ASSISTANT_STREAM_IDLE_TIMEOUT_MS = 12000
const ASSISTANT_META_MARKER = '\n__DFL_ASSISTANT_META__'

function timeoutError() {
  return new Error(
    'O assistente demorou mais que o esperado. Tente novamente.'
  )
}

async function getAuthenticatedResponse(
  messages: ChatMessage[],
  financialContext:
    FinancialAssistantContext,
  signal: AbortSignal
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
        signal,
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
  const controller =
    new AbortController()

  const requestTimeout =
    setTimeout(
      () => controller.abort(),
      ASSISTANT_REQUEST_TIMEOUT_MS
    )

  let response: Response

  try {
    response =
      await getAuthenticatedResponse(
        messages,
        financialContext,
        controller.signal
      )
  } catch (error: any) {
    clearTimeout(requestTimeout)

    if (
      controller.signal.aborted ||
      error?.name === 'AbortError'
    ) {
      throw timeoutError()
    }

    throw error
  }

  if (!response.body) {
    clearTimeout(requestTimeout)
    throw new Error(
      'O servidor não disponibilizou o fluxo da resposta.'
    )
  }

  const reader =
    response.body.getReader()

  const decoder =
    new TextDecoder()

  let fullText = ''

  try {
    while (true) {
      let idleTimeout:
        ReturnType<typeof setTimeout> |
        undefined

      const readResult =
        await Promise.race([
          reader.read(),
          new Promise<never>(
            (_, reject) => {
              idleTimeout =
                setTimeout(
                  () =>
                    reject(
                      timeoutError()
                    ),
                  ASSISTANT_STREAM_IDLE_TIMEOUT_MS
                )
            }
          ),
        ]).finally(() => {
          if (idleTimeout) {
            clearTimeout(
              idleTimeout
            )
          }
        })

      const {
        value,
        done,
      } = readResult

      if (done) break

      fullText +=
        decoder.decode(
          value,
          {
            stream: true,
          }
        )

      const visibleText =
        fullText.includes(
          ASSISTANT_META_MARKER
        )
          ? fullText.split(
              ASSISTANT_META_MARKER
            )[0]
          : fullText

      onUpdate?.(
        visibleText
      )
    }
  } catch (error) {
    controller.abort()

    try {
      await reader.cancel()
    } catch {
      // O stream já pode ter sido encerrado.
    }

    throw error
  } finally {
    clearTimeout(requestTimeout)
  }

  fullText +=
    decoder.decode()

  let responseText =
    fullText

  let finishReason = ''
  let wasTruncated = false

  const metaIndex =
    fullText.lastIndexOf(
      ASSISTANT_META_MARKER
    )

  if (metaIndex >= 0) {
    responseText =
      fullText.slice(
        0,
        metaIndex
      )

    const rawMeta =
      fullText
        .slice(
          metaIndex +
            ASSISTANT_META_MARKER.length
        )
        .trim()

    try {
      const meta =
        JSON.parse(
          rawMeta
        )

      finishReason =
        String(
          meta?.finishReason ||
            ''
        )

      wasTruncated =
        meta?.wasTruncated ===
        true
    } catch {
      finishReason =
        'INVALID_META'
    }
  }

  const normalized =
    responseText.trim()

  if (!normalized) {
    throw new Error(
      'O assistente retornou uma resposta vazia.'
    )
  }

  if (
    wasTruncated
  ) {
    throw new Error(
      'A resposta ficou incompleta antes de terminar. Tente novamente.'
    )
  }

  if (
    finishReason ===
    'INVALID_META'
  ) {
    throw new Error(
      'O assistente retornou uma resposta inválida. Tente novamente.'
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
