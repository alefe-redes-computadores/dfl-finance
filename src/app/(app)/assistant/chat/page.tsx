// src/app/(app)/assistant/chat/page.tsx
'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  ChevronLeft,
  Loader2,
  MessageSquare,
  Send,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import ContextToggle, {
  useContext_,
} from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import { addToSyncQueue, db } from '@/lib/db'
import {
  isRealizedFinancialTransaction,
} from '@/lib/financialMetrics'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  sendChatMessage,
  type FinancialAssistantContext,
} from '@/lib/services/chatService'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  type?: 'text' | 'insight' | 'suggestion'
}

const ChatSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((item) => (
      <div
        key={item}
        className={`flex ${
          item % 2 === 0
            ? 'justify-start'
            : 'justify-end'
        }`}
      >
        <div className="w-[76%] rounded-[24px] border border-gray-200/70 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 h-3 w-24 rounded bg-gray-200 dark:bg-slate-700" />
          <div className="mb-2 h-3 w-full rounded bg-gray-100 dark:bg-slate-700/50" />
          <div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-slate-700/50" />
        </div>
      </div>
    ))}
  </div>
)

export default function AssistantChatPage() {
  const router = useRouter()
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

  const [messages, setMessages] =
    useState<Message[]>([])

  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [isSending, setIsSending] =
    useState(false)

  const [sessionId, setSessionId] =
    useState<string | null>(null)

  const [showClearSheet, setShowClearSheet] =
    useState(false)

  const messagesEndRef =
    useRef<HTMLDivElement>(null)

  const inputRef =
    useRef<HTMLInputElement>(null)

  const { data: localSessions = [] } =
    useLocalData({
      table: 'chat_sessions' as any,
      filters: {
        user_id: user?.id,
      },
    })

  const { data: localMessages = [] } =
    useLocalData({
      table: 'chat_history' as any,
      filters: {
        user_id: user?.id,
        session_id: sessionId || '',
      },
    })

  const { data: localTransactions = [] } =
    useLocalData({
      table: 'transactions' as any,
      filters: {
        context: effectiveContext,
      },
    })

  const { data: localAccounts = [] } =
    useLocalData({
      table: 'accounts' as any,
      filters: {
        context: effectiveContext,
      },
    })

  const { data: localCategories = [] } =
    useLocalData({
      table: 'categories' as any,
      filters: {
        context: effectiveContext,
      },
    })

  useEffect(() => {
    if (!user?.id) return

    const sessions =
      (localSessions as any[])
        .filter(
          (session) =>
            session.user_id === user.id &&
            session.status === 'active'
        )
        .sort((a, b) =>
          String(
            b.created_at || ''
          ).localeCompare(
            String(a.created_at || '')
          )
        )

    setSessionId(
      sessions[0]?.id || null
    )

    setLoading(false)
  }, [user?.id, localSessions])

  useEffect(() => {
    const sorted =
      [...(localMessages as any[])].sort(
        (a, b) =>
          String(
            a.created_at || ''
          ).localeCompare(
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
  }, [messages, isSending])

  const financialContext =
    useMemo<FinancialAssistantContext>(() => {
      const now = new Date()

      const monthPrefix =
        `${now.getFullYear()}-` +
        `${String(
          now.getMonth() + 1
        ).padStart(2, '0')}`

      const transactions =
        (localTransactions as any[])
          .filter((transaction) =>
            isRealizedFinancialTransaction(
              transaction
            )
          )

      const currentMonth =
        transactions.filter(
          (transaction) =>
            String(
              transaction.date || ''
            ).startsWith(monthPrefix)
        )

      const currentMonthIncome =
        currentMonth
          .filter(
            (transaction) =>
              transaction.type === 'income'
          )
          .reduce(
            (sum, transaction) =>
              sum +
              Number(
                transaction.amount || 0
              ),
            0
          )

      const currentMonthExpense =
        currentMonth
          .filter(
            (transaction) =>
              transaction.type === 'expense' ||
              transaction.type === 'sangria'
          )
          .reduce(
            (sum, transaction) =>
              sum +
              Number(
                transaction.amount || 0
              ),
            0
          )

      const accountBalance =
        (localAccounts as any[])
          .filter(
            (account) =>
              account.user_id === user?.id ||
              !account.user_id
          )
          .reduce(
            (sum, account) =>
              sum +
              Number(
                account.balance || 0
              ),
            0
          )

      const categoryNames =
        new Map<string, string>(
          (localCategories as any[])
            .map((category) => [
              category.id,
              category.name,
            ])
        )

      const categoryTotals =
        new Map<string, number>()

      for (
        const transaction
        of currentMonth
      ) {
        if (
          transaction.type !== 'expense' &&
          transaction.type !== 'sangria'
        ) {
          continue
        }

        const categoryId =
          transaction.category_id ||
          'uncategorized'

        categoryTotals.set(
          categoryId,
          (
            categoryTotals.get(
              categoryId
            ) || 0
          ) +
            Number(
              transaction.amount || 0
            )
        )
      }

      const topExpenseCategories =
        [...categoryTotals.entries()]
          .map(
            ([categoryId, amount]) => ({
              name:
                categoryNames.get(
                  categoryId
                ) ||
                'Sem categoria',
              amount,
            })
          )
          .sort(
            (a, b) =>
              b.amount - a.amount
          )
          .slice(0, 5)

      return {
        context: effectiveContext,
        generatedAt:
          new Date().toISOString(),
        accountBalance,
        currentMonthIncome,
        currentMonthExpense,
        currentMonthNet:
          currentMonthIncome -
          currentMonthExpense,
        transactionCount:
          currentMonth.length,
        topExpenseCategories,
      }
    }, [
      effectiveContext,
      localAccounts,
      localCategories,
      localTransactions,
      user?.id,
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
    const now =
      new Date().toISOString()

    const payload = {
      id,
      user_id: user.id,
      title: 'Nova conversa',
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

  const handleSend = async () => {
    if (
      !input.trim() ||
      isSending ||
      !user?.id
    ) {
      return
    }

    const userMessage =
      input.trim()

    setInput('')
    setIsSending(true)

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
        created_at:
          new Date().toISOString(),
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

      const response =
        await sendChatMessage(
          history.map(
            (message) => ({
              role: message.role,
              content: message.content,
            })
          ),
          financialContext
        )

      const assistantPayload = {
        id: crypto.randomUUID(),
        user_id: user.id,
        session_id: currentSessionId,
        role: 'assistant' as const,
        content: response,
        type: 'text',
        created_at:
          new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }

      await persistMessage(
        assistantPayload
      )

      setMessages(
        (current) => [
          ...current,
          assistantPayload as Message,
        ]
      )

      success()
    } catch (error: any) {
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

  const handleKeyDown = (
    event: React.KeyboardEvent
  ) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault()
      handleSend()
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
      <div className="mx-auto min-h-screen max-w-md bg-[#f8f9fa] px-4 pb-28 pt-4 font-sans dark:bg-slate-900">
        <ChatSkeleton />
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f8f9fa] px-4 pb-32 pt-4 font-sans dark:bg-slate-900">
      <div className="sticky top-0 z-30 pb-3">
        <div className="rounded-[24px] border border-gray-200/70 bg-white/95 px-4 py-4 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/95">
          <div className="mb-3 flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-500 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <div className="inline-flex items-center gap-2">
                <MessageSquare
                  size={20}
                  className="text-teal-600"
                />
                <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                  Assistente
                </h1>
              </div>

              <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">
                Respostas com base no seu resumo financeiro atual
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                vibrate([4])
                setShowClearSheet(true)
              }}
              disabled={messages.length === 0}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-400 active:scale-[0.98] disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900/40"
              title="Limpar histórico"
            >
              <Trash2 size={18} />
            </button>
          </div>

          <ContextToggle />
        </div>
      </div>

      <div className="space-y-3 pb-4">
        {messages.length === 0 ? (
          <div className="mt-2 rounded-[24px] border border-gray-200/70 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-900/20">
                <Bot
                  size={30}
                  className="text-teal-600 dark:text-teal-400"
                />
              </div>

              <h2 className="mb-1 text-[16px] font-semibold text-gray-900 dark:text-gray-100">
                Como posso ajudar?
              </h2>

              <p className="mb-5 max-w-[270px] text-[12px] leading-5 text-gray-400 dark:text-gray-500">
                Posso analisar o saldo das contas, o fluxo do mês e as principais categorias de despesa disponíveis no contexto atual.
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                {[
                  'Qual é o saldo das minhas contas?',
                  'Como está meu mês?',
                  'Onde estou gastando mais?',
                  'O que posso melhorar agora?',
                ].map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => {
                      vibrate([4])
                      setInput(suggestion)
                    }}
                    className="rounded-[16px] border border-gray-200/70 bg-gray-50 px-3 py-2 text-[12px] font-medium text-gray-700 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user'
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[86%] rounded-[24px] border px-4 py-3 shadow-sm ${
                    message.role === 'user'
                      ? 'border-teal-600 bg-teal-600 text-white'
                      : 'border-gray-200/70 bg-white dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    {message.role === 'assistant' ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-teal-50 dark:bg-teal-900/20">
                        <Bot
                          size={13}
                          className="text-teal-600 dark:text-teal-400"
                        />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15">
                        <User
                          size={13}
                          className="text-teal-100"
                        />
                      </div>
                    )}

                    <span
                      className={`text-[11px] font-semibold ${
                        message.role === 'user'
                          ? 'text-teal-50'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {message.role === 'assistant'
                        ? 'Assistente'
                        : 'Você'}
                    </span>

                    <span
                      className={`text-[10px] ${
                        message.role === 'user'
                          ? 'text-teal-100/80'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {formatTime(message.created_at)}
                    </span>
                  </div>

                  <p
                    className={`whitespace-pre-wrap text-[14px] leading-6 ${
                      message.role === 'user'
                        ? 'text-white'
                        : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {message.content}
                  </p>
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex justify-start">
                <div className="rounded-[24px] border border-gray-200/70 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center gap-2">
                    <Loader2
                      size={16}
                      className="animate-spin text-teal-600"
                    />
                    <span className="text-[13px] text-gray-500 dark:text-gray-400">
                      Analisando...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="fixed bottom-24 left-0 right-0 mx-auto max-w-md px-4">
        <div className="flex items-end gap-2 rounded-[24px] border border-gray-200/70 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(event) =>
              setInput(event.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre suas finanças..."
            className="flex-1 rounded-[16px] border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-gray-800 outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200"
            disabled={isSending}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-teal-600 text-white shadow-lg shadow-teal-600/20 active:scale-[0.98] disabled:opacity-50"
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
            className="w-full max-w-md rounded-t-[32px] bg-white p-5 shadow-2xl dark:bg-slate-800"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                  Limpar conversa?
                </h3>

                <p className="mt-1 text-[13px] leading-5 text-gray-500 dark:text-gray-400">
                  As mensagens desta conversa serão removidas do aparelho e sincronizadas como exclusões.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowClearSheet(false)
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setShowClearSheet(false)
                }
                className="flex-1 rounded-[18px] border border-gray-200 py-3 text-[14px] font-semibold text-gray-700 dark:border-slate-700 dark:text-gray-300"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleClearChat}
                className="flex-1 rounded-[18px] bg-red-600 py-3 text-[14px] font-semibold text-white"
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
