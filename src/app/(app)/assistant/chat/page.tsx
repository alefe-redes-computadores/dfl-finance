// src/app/(app)/assistant/chat/page.tsx
'use client'

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  useRouter,
  useSearchParams,
} from 'next/navigation'
import {
  Bot,
  ChevronLeft,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Trash2,
  User,
  X,
  Sparkles,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import ContextToggle, {
  useContext_,
} from '@/components/ContextToggle'
import AssistantMessageContent from '@/components/assistant/AssistantMessageContent'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { useUserSettings } from '@/hooks/useUserSettings'
import { addToSyncQueue, db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  buildFinancialIntelligence,
  buildFinancialSuggestedQuestions,
  selectFinancialInsights,
} from '@/lib/financial-intelligence'
import {
  streamChatMessage,
  type FinancialAssistantContext,
} from '@/lib/services/chatService'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  type?: 'text' | 'insight' | 'suggestion'
}

function AssistantChatContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { context, appMode } = useContext_()

  const effectiveContext =
    appMode === 'personal_only'
      ? 'personal'
      : context

  const { showToast } = useToast()

  const {
    vibrate,
    success,
    error: errorHaptic,
  } = useHapticFeedback()

  const {
    settings: assistantSettings,
    loading: assistantSettingsLoading,
  } = useUserSettings()

  const aiEnabled =
    assistantSettings?.preferences.ai_enabled ?? true

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [failedRequest, setFailedRequest] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showClearSheet, setShowClearSheet] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const sessionTitle = `Assistente:${effectiveContext}`

  const { data: localSessions = [] } = useLocalData({
    table: 'chat_sessions',
  })

  const { data: localMessages = [] } = useLocalData({
    table: 'chat_history',
    filters: {
      session_id: sessionId || '',
    },
  })

  const tx = useLocalData({
    table: 'transactions',
    filters: {
      context: effectiveContext,
    },
  })

  const accounts = useLocalData({
    table: 'accounts',
    filters: {
      context: effectiveContext,
    },
  })

  const categories = useLocalData({
    table: 'categories',
    filters: {
      context: effectiveContext,
    },
  })

  const debts = useLocalData({
    table: 'debts',
    filters: {
      context: effectiveContext,
    },
  })

  const subscriptions = useLocalData({
    table: 'subscriptions',
    filters: {
      context: effectiveContext,
    },
  })

  const budgets = useLocalData({
    table: 'budgets',
    filters: {
      context: effectiveContext,
    },
  })

  const goals = useLocalData({
    table: 'goals',
    filters: {
      context: effectiveContext,
    },
  })

  const loans = useLocalData({
    table: 'loans',
    filters: {
      context: effectiveContext,
    },
  })

  const financings = useLocalData({
    table: 'financings',
    filters: {
      context: effectiveContext,
    },
  })

  const creditCards = useLocalData({
    table: 'credit_cards',
    filters: {
      context: effectiveContext,
    },
  })

  const creditInvoices = useLocalData({
    table: 'credit_invoices',
    filters: {
      context: effectiveContext,
    },
  })

  const intelligence = useMemo(
    () =>
      buildFinancialIntelligence({
        context: effectiveContext,
        transactions: tx.data as any[],
        accounts: accounts.data as any[],
        categories: categories.data as any[],
        debts: debts.data as any[],
        subscriptions: subscriptions.data as any[],
        budgets: budgets.data as any[],
        goals: goals.data as any[],
        loans: loans.data as any[],
        financings: financings.data as any[],
        creditCards: creditCards.data as any[],
        creditInvoices: creditInvoices.data as any[],
      }),
    [
      effectiveContext,
      tx.data,
      accounts.data,
      categories.data,
      debts.data,
      subscriptions.data,
      budgets.data,
      goals.data,
      loans.data,
      financings.data,
      creditCards.data,
      creditInvoices.data,
    ]
  )

  const suggestedQuestions = useMemo(
    () =>
      buildFinancialSuggestedQuestions(
        intelligence,
        4
      ),
    [intelligence]
  )

  const financialContext = useMemo<FinancialAssistantContext>(
    () => ({
      context: effectiveContext,
      generatedAt: intelligence.generatedAt,
      snapshot: intelligence.snapshot,
      insights: selectFinancialInsights(
        intelligence,
        { limit: 8 }
      ),
      suggestedQuestions,
    }),
    [
      effectiveContext,
      intelligence,
      suggestedQuestions,
    ]
  )

  useEffect(() => {
    if (!user?.id) return

    setMessages([])
    setSessionId(null)
    setFailedRequest(false)
    setStreamingContent('')

    const sessions =
      (localSessions as any[])
        .filter(
          (session) =>
            session.user_id === user.id &&
            session.status === 'active' &&
            session.title === sessionTitle
        )
        .sort((a, b) =>
          String(b.created_at || '').localeCompare(
            String(a.created_at || '')
          )
        )

    setSessionId(
      sessions[0]?.id || null
    )

    setLoading(false)
  }, [
    user?.id,
    localSessions,
    sessionTitle,
  ])

  useEffect(() => {
    const sorted =
      [...(localMessages as any[])].sort(
        (a, b) =>
          String(a.created_at || '').localeCompare(
            String(b.created_at || '')
          )
      )

    setMessages(
      sorted as Message[]
    )
  }, [localMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [
    messages,
    streamingContent,
    isSending,
    failedRequest,
  ])

  useEffect(() => {
    const query =
      searchParams.get('q')?.trim()

    if (query && !input) {
      setInput(query)
    }
  }, [
    searchParams,
    input,
  ])

  const persistMessage = async (
    payload: Record<string, any>
  ) => {
    if (!user?.id) {
      throw new Error(
        'Usuário não identificado.'
      )
    }

    await db.transaction(
      'rw',
      db.table('chat_history'),
      db.syncQueue,
      async () => {
        await db
          .table('chat_history')
          .add(payload)

        await addToSyncQueue(
          user.id,
          'chat_history',
          'create',
          payload.id,
          payload
        )
      }
    )
  }

  const ensureSession = async () => {
    if (!user?.id) {
      throw new Error(
        'Usuário não identificado.'
      )
    }

    if (sessionId) {
      return sessionId
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    const payload = {
      id,
      user_id: user.id,
      title: sessionTitle,
      status: 'active',
      created_at: now,
      updated_at: now,
      sync_status: 'pending',
      sync_attempts: 0,
    }

    await db.transaction(
      'rw',
      db.table('chat_sessions'),
      db.syncQueue,
      async () => {
        await db
          .table('chat_sessions')
          .add(payload)

        await addToSyncQueue(
          user.id,
          'chat_sessions',
          'create',
          id,
          payload
        )
      }
    )

    setSessionId(id)

    return id
  }

  const requestAssistant = async (
    history: Message[],
    currentSessionId: string
  ) => {
    setIsSending(true)
    setFailedRequest(false)
    setStreamingContent('')

    try {
      const response =
        await streamChatMessage(
          history.map(
            (message) => ({
              role: message.role,
              content: message.content,
            })
          ),
          financialContext,
          (fullText) => {
            setStreamingContent(fullText)
          }
        )

      const assistantPayload = {
        id: crypto.randomUUID(),
        user_id: user!.id,
        session_id: currentSessionId,
        role: 'assistant' as const,
        content: response,
        type: 'text',
        created_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }

      await persistMessage(
        assistantPayload
      )

      setStreamingContent('')

      setMessages(
        (current) => [
          ...current,
          assistantPayload as Message,
        ]
      )

      success()
    } catch (error: any) {
      setStreamingContent('')
      setFailedRequest(true)

      errorHaptic()

      showToast(
        error?.message ||
          'Erro ao consultar o assistente.',
        'error'
      )
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleSend = async () => {
    if (
      !input.trim() ||
      isSending ||
      assistantSettingsLoading ||
      !user?.id
    ) {
      return
    }

    if (!aiEnabled) {
      errorHaptic()

      showToast(
        'Ative o Chat inteligente nas configurações para conversar.',
        'warning'
      )

      return
    }

    const userMessage = input.trim()

    setInput('')
    setFailedRequest(false)

    vibrate([8])

    try {
      const currentSessionId =
        await ensureSession()

      const userPayload = {
        id: crypto.randomUUID(),
        user_id: user.id,
        session_id: currentSessionId,
        role: 'user' as const,
        content: userMessage,
        created_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }

      await persistMessage(
        userPayload
      )

      const history = [
        ...messages,
        userPayload,
      ] as Message[]

      setMessages(history)

      await requestAssistant(
        history,
        currentSessionId
      )
    } catch (error: any) {
      errorHaptic()

      showToast(
        error?.message ||
          'Erro ao preparar a conversa.',
        'error'
      )
    }
  }

  const handleRetry = async () => {
    if (
      isSending ||
      !sessionId ||
      messages.length === 0
    ) {
      return
    }

    await requestAssistant(
      messages,
      sessionId
    )
  }

  const handleClearChat = async () => {
    if (
      !sessionId ||
      !user?.id ||
      messages.length === 0
    ) {
      setShowClearSheet(false)
      return
    }

    try {
      vibrate([10])

      const ids =
        messages.map(
          (message) => message.id
        )

      await db.transaction(
        'rw',
        db.table('chat_history'),
        db.syncQueue,
        async () => {
          for (const id of ids) {
            await db
              .table('chat_history')
              .delete(id)

            await addToSyncQueue(
              user.id,
              'chat_history',
              'delete',
              id,
              { id }
            )
          }
        }
      )

      setMessages([])
      setFailedRequest(false)
      setShowClearSheet(false)

      success()

      showToast(
        'Histórico limpo.',
        'success'
      )
    } catch (error: any) {
      errorHaptic()

      showToast(
        error?.message ||
          'Erro ao limpar histórico.',
        'error'
      )
    }
  }

  const formatTime = (
    date: string
  ) => {
    const parsed =
      new Date(date)

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return ''
    }

    return format(
      parsed,
      'HH:mm',
      {
        locale: ptBR,
      }
    )
  }

  if (loading) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-[#f7f8fa] p-5 dark:bg-slate-950">
        <div className="h-32 animate-pulse rounded-[28px] bg-white dark:bg-slate-900" />
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f7f8fa] px-4 pb-36 pt-4 font-sans dark:bg-slate-950">
      <div className="sticky top-0 z-30 pb-3">
        <div className="rounded-[24px] border border-gray-200/70 bg-white/95 px-4 py-4 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-gray-50 text-gray-500 active:scale-95 dark:bg-slate-800 dark:text-gray-300"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <div className="flex items-center justify-center gap-2">
                <Sparkles
                  size={17}
                  className="text-teal-600"
                />

                <h1 className="text-[18px] font-bold text-gray-900 dark:text-white">
                  Assistente financeiro
                </h1>
              </div>

              <p className="mt-0.5 text-[11px] text-gray-400">
                Inteligência do contexto atual
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                vibrate([4])
                setShowClearSheet(true)
              }}
              disabled={messages.length === 0}
              className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-gray-50 text-gray-400 active:scale-95 disabled:opacity-30 dark:bg-slate-800"
            >
              <Trash2 size={17} />
            </button>
          </div>

          <ContextToggle />
        </div>
      </div>

      <div className="space-y-3">
        {messages.length === 0 &&
        !isSending ? (
          <section className="rounded-[28px] border border-gray-200/70 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-teal-50 dark:bg-teal-500/10">
              <Bot
                size={29}
                className="text-teal-600 dark:text-teal-400"
              />
            </div>

            <div className="mt-4 text-center">
              <h2 className="text-[17px] font-bold text-gray-900 dark:text-white">
                O que quer entender?
              </h2>

              <p className="mx-auto mt-1 max-w-[280px] text-[12px] leading-5 text-gray-400">
                O aplicativo já analisou tendências, caixa, categorias, recebíveis e qualidade da amostra.
              </p>
            </div>

            <div className="mt-5 space-y-2">
              {suggestedQuestions.map(
                (suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => {
                      vibrate([4])
                      setInput(suggestion)
                    }}
                    className="flex w-full items-center justify-between rounded-[18px] bg-gray-50 px-4 py-3 text-left active:scale-[0.99] dark:bg-slate-800/70"
                  >
                    <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">
                      {suggestion}
                    </span>

                    <MessageSquare
                      size={15}
                      className="shrink-0 text-teal-500"
                    />
                  </button>
                )
              )}
            </div>
          </section>
        ) : (
          <div className="space-y-3">
            {messages.map(
              (message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === 'user'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-[24px] border px-4 py-3 shadow-sm ${
                      message.role === 'user'
                        ? 'border-teal-600 bg-teal-600 text-white'
                        : 'border-gray-200/70 bg-white dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-full ${
                          message.role === 'user'
                            ? 'bg-white/15'
                            : 'bg-teal-50 dark:bg-teal-500/10'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <Bot
                            size={13}
                            className="text-teal-600 dark:text-teal-400"
                          />
                        ) : (
                          <User
                            size={13}
                            className="text-white"
                          />
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-semibold ${
                          message.role === 'user'
                            ? 'text-teal-50'
                            : 'text-gray-400'
                        }`}
                      >
                        {message.role === 'assistant'
                          ? 'Assistente'
                          : 'Você'}
                      </span>

                      <span
                        className={`text-[9px] ${
                          message.role === 'user'
                            ? 'text-teal-100'
                            : 'text-gray-400'
                        }`}
                      >
                        {formatTime(
                          message.created_at
                        )}
                      </span>
                    </div>

                    {message.role === 'assistant' ? (
                      <AssistantMessageContent
                        content={message.content}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-[14px] leading-6 text-white">
                        {message.content}
                      </p>
                    )}
                  </div>
                </div>
              )
            )}

            {isSending && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-[24px] border border-gray-200/70 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-500/10">
                      <Bot
                        size={13}
                        className="text-teal-600"
                      />
                    </div>

                    <span className="text-[10px] font-semibold text-gray-400">
                      Assistente
                    </span>
                  </div>

                  {streamingContent ? (
                    <AssistantMessageContent
                      content={streamingContent}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2
                        size={15}
                        className="animate-spin text-teal-600"
                      />

                      <span className="text-[12px] text-gray-500 dark:text-gray-400">
                        Comparando seus dados com segurança...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {failedRequest &&
              !isSending && (
              <div className="flex justify-start">
                <div className="rounded-[22px] border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                  <p className="text-[12px] font-semibold text-red-700 dark:text-red-300">
                    Não consegui concluir esta resposta.
                  </p>

                  <button
                    type="button"
                    onClick={handleRetry}
                    className="mt-3 flex items-center gap-2 rounded-[15px] bg-white px-3 py-2 text-[11px] font-bold text-red-600 shadow-sm active:scale-95 dark:bg-slate-900"
                  >
                    <RefreshCw size={14} />
                    Tentar novamente
                  </button>
                </div>
              </div>
            )}

            <div
              ref={messagesEndRef}
            />
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-0 right-0 z-40 mx-auto max-w-md px-4">
        <div className="flex items-center gap-2 rounded-[24px] border border-gray-200/70 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <input
            ref={inputRef}
            value={input}
            onChange={(event) =>
              setInput(
                event.target.value
              )
            }
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey
              ) {
                event.preventDefault()
                handleSend()
              }
            }}
            disabled={
              isSending ||
              !aiEnabled ||
              assistantSettingsLoading
            }
            placeholder={
              aiEnabled
                ? 'Pergunte sobre suas finanças...'
                : 'Chat inteligente desativado'
            }
            className="min-w-0 flex-1 rounded-[17px] bg-gray-50 px-4 py-3 text-[14px] text-gray-900 outline-none placeholder:text-gray-400 dark:bg-slate-800 dark:text-white"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={
              !input.trim() ||
              isSending ||
              !aiEnabled ||
              assistantSettingsLoading
            }
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-teal-600 text-white shadow-lg shadow-teal-600/20 active:scale-95 disabled:opacity-40"
          >
            {isSending ? (
              <Loader2
                size={18}
                className="animate-spin"
              />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>

      {showClearSheet && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 backdrop-blur-sm"
          onClick={() =>
            setShowClearSheet(false)
          }
        >
          <div
            className="w-full max-w-md rounded-t-[32px] bg-white p-5 shadow-2xl dark:bg-slate-900"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[18px] font-bold text-gray-900 dark:text-white">
                  Limpar conversa?
                </h3>

                <p className="mt-1 text-[12px] leading-5 text-gray-500">
                  As mensagens deste contexto serão removidas e sincronizadas como exclusões.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowClearSheet(false)
                }
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowClearSheet(false)
                }
                className="flex-1 rounded-[18px] bg-gray-100 py-3 text-[13px] font-semibold dark:bg-slate-800"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleClearChat}
                className="flex-1 rounded-[18px] bg-red-600 py-3 text-[13px] font-semibold text-white"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AssistantChatPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto min-h-screen max-w-md bg-[#f7f8fa] p-5 dark:bg-slate-950">
          <div className="h-32 animate-pulse rounded-[28px] bg-white dark:bg-slate-900" />
        </div>
      }
    >
      <AssistantChatContent />
    </Suspense>
  )
}
