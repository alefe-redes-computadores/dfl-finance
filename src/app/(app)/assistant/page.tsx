// src/app/(app)/assistant/page.tsx
'use client'

import {
  useMemo,
} from 'react'
import {
  useRouter,
} from 'next/navigation'
import {
  Bot,
  ChevronLeft,
  FileText,
  MessageSquare,
  Settings,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
  AlertTriangle,
  CircleGauge,
  ChevronRight,
} from 'lucide-react'

import ContextToggle, {
  ContextProvider,
  useContext_,
} from '@/components/ContextToggle'
import {
  useLocalData,
} from '@/hooks/useLocalData'
import {
  useUserSettings,
} from '@/hooks/useUserSettings'
import {
  buildFinancialIntelligence,
  buildFinancialSuggestedQuestions,
  selectFinancialInsights,
  type FinancialInsight,
} from '@/lib/financial-intelligence'
import {
  formatCurrency,
} from '@/lib/utils'

const AssistantSkeleton =
  () => (
    <div className="space-y-3 animate-pulse">
      <div className="h-44 rounded-[28px] bg-white dark:bg-slate-800" />
      <div className="h-40 rounded-[28px] bg-white dark:bg-slate-800" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 rounded-[24px] bg-white dark:bg-slate-800" />
        <div className="h-28 rounded-[24px] bg-white dark:bg-slate-800" />
      </div>
    </div>
  )

function insightTone(
  insight: FinancialInsight
) {
  switch (
    insight.severity
  ) {
    case 'critical':
      return {
        wrap:
          'border-red-200 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/20',
        icon:
          'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
      }

    case 'warning':
      return {
        wrap:
          'border-orange-200 bg-orange-50/80 dark:border-orange-900/50 dark:bg-orange-950/20',
        icon:
          'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
      }

    case 'attention':
      return {
        wrap:
          'border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20',
        icon:
          'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
      }

    case 'opportunity':
      return {
        wrap:
          'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/20',
        icon:
          'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
      }

    default:
      return {
        wrap:
          'border-blue-200 bg-blue-50/70 dark:border-blue-900/40 dark:bg-blue-950/20',
        icon:
          'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
      }
  }
}

function AssistantContent() {
  const router =
    useRouter()

  const {
    context,
    appMode,
  } =
    useContext_()

  const effectiveContext =
    appMode ===
    'personal_only'
      ? 'personal'
      : context

  const {
    settings,
    loading:
      settingsLoading,
  } =
    useUserSettings()

  const aiEnabled =
    settings
      ?.preferences
      .ai_enabled ??
    true

  const tx =
    useLocalData({
      table:
        'transactions',
      filters: {
        context:
          effectiveContext,
      },
    })

  const accounts =
    useLocalData({
      table:
        'accounts',
      filters: {
        context:
          effectiveContext,
      },
    })

  const categories =
    useLocalData({
      table:
        'categories',
      filters: {
        context:
          effectiveContext,
      },
    })

  const debts =
    useLocalData({
      table:
        'debts',
      filters: {
        context:
          effectiveContext,
      },
    })

  const subscriptions =
    useLocalData({
      table:
        'subscriptions',
      filters: {
        context:
          effectiveContext,
      },
    })

  const intelligence =
    useMemo(
      () =>
        buildFinancialIntelligence({
          context:
            effectiveContext,
          transactions:
            tx.data as any[],
          accounts:
            accounts.data as any[],
          categories:
            categories.data as any[],
          debts:
            debts.data as any[],
          subscriptions:
            subscriptions.data as any[],
        }),
      [
        effectiveContext,
        tx.data,
        accounts.data,
        categories.data,
        debts.data,
        subscriptions.data,
      ]
    )

  const highlights =
    useMemo(
      () =>
        selectFinancialInsights(
          intelligence,
          {
            limit: 3,
          }
        ),
      [intelligence]
    )

  const questions =
    useMemo(
      () =>
        buildFinancialSuggestedQuestions(
          intelligence,
          3
        ),
      [intelligence]
    )

  const snapshot =
    intelligence.snapshot

  const loading =
    settingsLoading ||
    tx.loading ||
    accounts.loading ||
    categories.loading ||
    debts.loading ||
    subscriptions.loading

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f7f8fa] pb-28 font-sans dark:bg-slate-950">
      <div className="sticky top-0 z-40 border-b border-gray-200/60 bg-[#f7f8fa]/94 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/94">
        <div className="rounded-[24px] border border-gray-200/70 bg-white/95 px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                router.push(
                  '/more'
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-gray-50 text-gray-500 active:scale-95 dark:bg-slate-800 dark:text-gray-300"
            >
              <ChevronLeft
                size={20}
              />
            </button>

            <div className="min-w-0 text-center">
              <div className="flex items-center justify-center gap-2">
                <Sparkles
                  size={18}
                  className="text-teal-600"
                />
                <h1 className="text-[19px] font-bold tracking-tight text-gray-900 dark:text-white">
                  Inteligência financeira
                </h1>
              </div>

              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                Análise local + Assistente
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  '/assistant/settings'
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-gray-50 text-gray-500 active:scale-95 dark:bg-slate-800 dark:text-gray-300"
            >
              <Settings
                size={18}
              />
            </button>
          </div>

          <ContextToggle />
        </div>
      </div>

      <div className="space-y-3 px-4 pt-3">
        {loading ? (
          <AssistantSkeleton />
        ) : (
          <>
            {!aiEnabled && (
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
                  Chat inteligente desativado
                </p>
                <p className="mt-1 text-[12px] leading-5 text-amber-700 dark:text-amber-400">
                  O cérebro financeiro local continua funcionando normalmente.
                </p>
              </div>
            )}

            <section className="overflow-hidden rounded-[28px] border border-gray-200/70 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                      Saldo atual
                    </p>

                    <p className="mt-2 text-[32px] font-black leading-none tracking-tight text-gray-950 dark:text-white">
                      {formatCurrency(
                        snapshot.accountBalance
                      )}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          snapshot.currentMonthNet >=
                          0
                            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400'
                        }`}
                      >
                        Mês{' '}
                        {snapshot.currentMonthNet >=
                        0
                          ? 'positivo'
                          : 'negativo'}
                      </span>

                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        confiança{' '}
                        {snapshot.confidence ===
                        'high'
                          ? 'alta'
                          : snapshot.confidence ===
                              'medium'
                            ? 'média'
                            : 'baixa'}
                      </span>
                    </div>
                  </div>

                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-teal-50 dark:bg-teal-500/10">
                    <Wallet
                      size={21}
                      className="text-teal-600 dark:text-teal-400"
                    />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-[18px] bg-gray-50 p-3 dark:bg-slate-800/70">
                    <p className="text-[11px] text-gray-400">
                      Receitas
                    </p>
                    <p className="mt-1 text-[15px] font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(
                        snapshot.currentMonthIncome
                      )}
                    </p>
                  </div>

                  <div className="rounded-[18px] bg-gray-50 p-3 dark:bg-slate-800/70">
                    <p className="text-[11px] text-gray-400">
                      Despesas
                    </p>
                    <p className="mt-1 text-[15px] font-bold text-red-500 dark:text-red-400">
                      {formatCurrency(
                        snapshot.currentMonthExpense
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-950/30">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">
                    Resultado do mês
                  </span>

                  <span
                    className={`text-[14px] font-bold ${
                      snapshot.currentMonthNet >=
                      0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {formatCurrency(
                      snapshot.currentMonthNet
                    )}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                    Prioridades
                  </p>
                  <h2 className="mt-1 text-[17px] font-bold text-gray-900 dark:text-white">
                    O que merece atenção
                  </h2>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-indigo-50 dark:bg-indigo-500/10">
                  <CircleGauge
                    size={18}
                    className="text-indigo-600 dark:text-indigo-400"
                  />
                </div>
              </div>

              {highlights.length ===
              0 ? (
                <div className="rounded-[20px] bg-gray-50 p-4 dark:bg-slate-800/70">
                  <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">
                    Nenhum sinal forte agora
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-gray-400">
                    O histórico ainda pode estar ganhando amostra ou não há desvios relevantes.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {highlights.map(
                    (insight) => {
                      const tone =
                        insightTone(
                          insight
                        )

                      return (
                        <button
                          type="button"
                          key={
                            insight.id
                          }
                          onClick={() => {
                            const query =
                              insight.suggestedQuestion

                            router.push(
                              query
                                ? `/assistant/chat?q=${encodeURIComponent(query)}`
                                : '/assistant/chat'
                            )
                          }}
                          className={`w-full rounded-[20px] border p-4 text-left transition-transform active:scale-[0.99] ${tone.wrap}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] ${tone.icon}`}>
                              {insight.severity ===
                              'critical' ||
                              insight.severity ===
                                'warning' ? (
                                <AlertTriangle
                                  size={17}
                                />
                              ) : insight.type.includes(
                                  'income'
                                ) ||
                                insight.severity ===
                                  'opportunity' ? (
                                <TrendingUp
                                  size={17}
                                />
                              ) : (
                                <TrendingDown
                                  size={17}
                                />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-bold text-gray-900 dark:text-white">
                                {
                                  insight.title
                                }
                              </p>

                              <p className="mt-1 text-[12px] leading-5 text-gray-600 dark:text-gray-400">
                                {
                                  insight.message
                                }
                              </p>

                              {typeof insight.deltaPercent ===
                                'number' && (
                                <p className="mt-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                  {insight.deltaPercent >
                                  0
                                    ? '+'
                                    : ''}
                                  {insight.deltaPercent.toFixed(
                                    1
                                  )}
                                  % na comparação
                                </p>
                              )}
                            </div>

                            <ChevronRight
                              size={17}
                              className="mt-1 shrink-0 text-gray-400"
                            />
                          </div>
                        </button>
                      )
                    }
                  )}
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex items-center gap-2">
                <Bot
                  size={18}
                  className="text-teal-600"
                />
                <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">
                  Pergunte ao Assistente
                </h2>
              </div>

              <div className="space-y-2">
                {questions.map(
                  (question) => (
                    <button
                      type="button"
                      key={
                        question
                      }
                      onClick={() =>
                        router.push(
                          aiEnabled
                            ? `/assistant/chat?q=${encodeURIComponent(question)}`
                            : '/assistant/settings'
                        )
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-[18px] bg-gray-50 px-4 py-3 text-left active:scale-[0.99] dark:bg-slate-800/70"
                    >
                      <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300">
                        {
                          question
                        }
                      </span>

                      <ChevronRight
                        size={15}
                        className="shrink-0 text-gray-400"
                      />
                    </button>
                  )
                )}
              </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    aiEnabled
                      ? '/assistant/chat'
                      : '/assistant/settings'
                  )
                }
                className="rounded-[24px] border border-gray-200/70 bg-white p-5 text-left shadow-sm active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-teal-50 dark:bg-teal-500/10">
                  <MessageSquare
                    size={19}
                    className="text-teal-600 dark:text-teal-400"
                  />
                </div>

                <p className="mt-4 text-[15px] font-bold text-gray-900 dark:text-white">
                  Chat
                </p>

                <p className="mt-1 text-[11px] leading-4 text-gray-400">
                  Converse sobre os sinais financeiros
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    '/assistant/report'
                  )
                }
                className="rounded-[24px] border border-gray-200/70 bg-white p-5 text-left shadow-sm active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-indigo-50 dark:bg-indigo-500/10">
                  <FileText
                    size={19}
                    className="text-indigo-600 dark:text-indigo-400"
                  />
                </div>

                <p className="mt-4 text-[15px] font-bold text-gray-900 dark:text-white">
                  Relatório
                </p>

                <p className="mt-1 text-[11px] leading-4 text-gray-400">
                  Explore números e evolução
                </p>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function AssistantPage() {
  return (
    <ContextProvider>
      <AssistantContent />
    </ContextProvider>
  )
}
