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

export type AssistantProcessingStage =
  | 'preparing'
  | 'connecting'
  | 'generating'
  | 'streaming'
  | 'finalizing'

const ASSISTANT_CONNECT_TIMEOUT_MS = 35000
const ASSISTANT_STREAM_IDLE_TIMEOUT_MS = 30000
const ASSISTANT_STREAM_MAX_TIMEOUT_MS = 120000
const ASSISTANT_META_MARKER = '\n__DFL_ASSISTANT_META__'

export type AssistantErrorCode =
  | 'auth'
  | 'connect_timeout'
  | 'stream_idle'
  | 'stream_timeout'
  | 'provider'
  | 'truncated'
  | 'invalid_response'
  | 'empty_response'
  | 'network'
  | 'unknown'

export class AssistantChatError extends Error {
  code: AssistantErrorCode
  retryable: boolean
  partialText: string

  constructor(
    code: AssistantErrorCode,
    message: string,
    options?: {
      retryable?: boolean
      partialText?: string
    }
  ) {
    super(message)
    this.name = 'AssistantChatError'
    this.code = code
    this.retryable = options?.retryable ?? true
    this.partialText = options?.partialText || ''
  }
}

function assistantError(
  code: AssistantErrorCode,
  message: string,
  options?: {
    retryable?: boolean
    partialText?: string
  }
) {
  return new AssistantChatError(
    code,
    message,
    options
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
    throw assistantError(
      'auth',
      'Sua sessão expirou. Entre novamente para usar o Assistente.',
      { retryable: false }
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

    const code: AssistantErrorCode =
      response.status === 401
        ? 'auth'
        : response.status === 504
          ? 'connect_timeout'
          : response.status >= 500
            ? 'provider'
            : 'unknown'

    throw assistantError(
      code,
      message,
      {
        retryable:
          response.status !== 401,
      }
    )
  }

  return response
}

export async function streamChatMessage(
  messages: ChatMessage[],
  financialContext:
    FinancialAssistantContext,
  onUpdate?: (
    fullText: string
  ) => void,
  onStage?: (
    stage: AssistantProcessingStage
  ) => void
): Promise<string> {
  const controller =
    new AbortController()

  onStage?.('preparing')

  const connectTimeout =
    setTimeout(
      () => controller.abort(),
      ASSISTANT_CONNECT_TIMEOUT_MS
    )

  let response: Response

  try {
    onStage?.('connecting')

    response =
      await getAuthenticatedResponse(
        messages,
        financialContext,
        controller.signal
      )

    clearTimeout(
      connectTimeout
    )

    onStage?.('generating')
  } catch (error: any) {
    clearTimeout(connectTimeout)

    if (
      controller.signal.aborted ||
      error?.name === 'AbortError'
    ) {
      throw assistantError(
        'connect_timeout',
        'A conexão com o Assistente demorou mais que o esperado.',
      )
    }

    throw error
  }

  if (!response.body) {
    clearTimeout(connectTimeout)
    throw assistantError(
      'invalid_response',
      'O servidor respondeu sem disponibilizar o fluxo da resposta.',
    )
  }

  const reader =
    response.body.getReader()

  const decoder =
    new TextDecoder()

  let fullText = ''

  let streamMaxExpired = false

  const streamMaxTimeout =
    setTimeout(
      () => {
        streamMaxExpired = true
        controller.abort()
      },
      ASSISTANT_STREAM_MAX_TIMEOUT_MS
    )

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
                      assistantError(
                        'stream_idle',
                        'A resposta parou de chegar por tempo demais.',
                        {
                          partialText:
                            fullText.includes(
                              ASSISTANT_META_MARKER
                            )
                              ? fullText.split(
                                  ASSISTANT_META_MARKER
                                )[0].trim()
                              : fullText.trim(),
                        }
                      )
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

      if (
        visibleText.trim()
      ) {
        onStage?.('streaming')
      }

      onUpdate?.(
        visibleText
      )
    }
  } catch (error: any) {
    controller.abort()

    try {
      await reader.cancel()
    } catch {
      // O stream já pode ter sido encerrado.
    }

    if (
      error instanceof AssistantChatError
    ) {
      throw error
    }

    const partialText =
      fullText.includes(
        ASSISTANT_META_MARKER
      )
        ? fullText.split(
            ASSISTANT_META_MARKER
          )[0].trim()
        : fullText.trim()

    if (
      streamMaxExpired ||
      error?.name === 'AbortError'
    ) {
      throw assistantError(
        'stream_timeout',
        'A geração levou tempo demais e foi interrompida.',
        { partialText }
      )
    }

    throw assistantError(
      'network',
      'A conexão foi interrompida enquanto a resposta chegava.',
      { partialText }
    )
  } finally {
    clearTimeout(connectTimeout)
    clearTimeout(streamMaxTimeout)
  }

  onStage?.('finalizing')

  fullText +=
    decoder.decode()

  let responseText =
    fullText

  let finishReason = ''
  let wasTruncated = false
  let providerError = ''

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

      providerError =
        typeof meta?.error === 'string'
          ? meta.error
          : ''
    } catch {
      finishReason =
        'INVALID_META'
    }
  }

  const normalized =
    responseText.trim()

  if (providerError) {
    throw assistantError(
      'provider',
      providerError,
      {
        partialText: normalized,
      }
    )
  }

  if (!normalized) {
    throw assistantError(
      'empty_response',
      'O provedor terminou sem devolver uma resposta.',
    )
  }

  if (
    wasTruncated
  ) {
    throw assistantError(
      'truncated',
      'A resposta atingiu o limite antes de concluir.',
      {
        partialText: normalized,
      }
    )
  }

  if (
    finishReason ===
    'INVALID_META'
  ) {
    throw assistantError(
      'invalid_response',
      'O Assistente recebeu um encerramento inválido do provedor.',
      {
        partialText: normalized,
      }
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
