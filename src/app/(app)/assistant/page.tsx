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

  const budgets =
    useLocalData({
      table:
        'budgets',
      filters: {
        context:
          effectiveContext,
      },
    })

  const goals =
    useLocalData({
      table:
        'goals',
      filters: {
        context:
          effectiveContext,
      },
    })

  const loans =
    useLocalData({
      table:
        'loans',
      filters: {
        context:
          effectiveContext,
      },
    })

  const financings =
    useLocalData({
      table:
        'financings',
      filters: {
        context:
          effectiveContext,
      },
    })

  const creditCards =
    useLocalData({
      table:
        'credit_cards',
      filters: {
        context:
          effectiveContext,
      },
    })

  const creditInvoices =
    useLocalData({
      table:
        'credit_invoices',
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
          budgets:
            budgets.data as any[],
          goals:
            goals.data as any[],
          loans:
            loans.data as any[],
          financings:
            financings.data as any[],
          creditCards:
            creditCards.data as any[],
          creditInvoices:
            creditInvoices.data as any[],
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
    subscriptions.loading ||
    budgets.loading ||
    goals.loading ||
    loans.loading ||
    financings.loading ||
    creditCards.loading ||
    creditInvoices.loading

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

            <button
              type="button"
              onClick={() => router.push('/agenda')}
              className="mb-3 flex w-full items-center gap-3 rounded-[22px] border border-indigo-200/70 bg-indigo-50/70 px-4 py-4 text-left active:scale-[0.99] dark:border-indigo-800/50 dark:bg-indigo-900/20"
            >
              <FileText size={20} className="shrink-0 text-indigo-700 dark:text-indigo-400" />
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-indigo-900 dark:text-indigo-200">Agenda Financeira 360</span><span className="mt-1 block text-[11px] text-indigo-800/80 dark:text-indigo-300/80">Faturas, pendências, cobranças e planejamento separados</span></span>
              <ChevronRight size={16} className="text-indigo-700 dark:text-indigo-400" />
            </button>
            <button
              type="button"
              onClick={() => router.push('/review')}
              className="flex w-full items-center gap-3 rounded-[22px] border border-teal-200/70 bg-teal-50/70 px-4 py-4 text-left active:scale-[0.99] dark:border-teal-800/50 dark:bg-teal-900/20"
            >
              <Bot size={20} className="shrink-0 text-teal-700 dark:text-teal-400" />
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold text-teal-900 dark:text-teal-200">Central de Revisão Inteligente</span><span className="mt-1 block text-[11px] text-teal-800/80 dark:text-teal-300/80">Duplicações, recorrências, importações e gastos fora do padrão</span></span>
              <ChevronRight size={16} className="text-teal-700 dark:text-teal-400" />
            </button>

            <button type="button" onClick={() => router.push('/cash-pressure')} className="mb-3 flex min-h-14 w-full items-center justify-between rounded-[22px] border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-left dark:border-rose-800/40 dark:bg-rose-900/20"><span><span className="block text-[13px] font-bold text-rose-800 dark:text-rose-200">Radar de Fôlego</span><span className="mt-1 block text-[11px] text-rose-700 dark:text-rose-300">Caixa, vencimentos, cenários e prioridades</span></span><ChevronRight size={18}/></button>
            <button type="button" onClick={() => router.push('/planning')} className="mb-3 flex min-h-16 w-full items-center justify-between gap-3 rounded-[22px] border border-violet-200/70 bg-violet-50/70 px-4 py-3 text-left transition active:scale-[0.98] dark:border-violet-800/50 dark:bg-violet-900/20"><span className="min-w-0"><span className="block text-[13px] font-bold text-violet-900 dark:text-violet-200">Meu plano financeiro</span><span className="mt-1 block text-[11px] text-violet-700 dark:text-violet-300">Fixos, flexíveis, reservas e orçamento não mensal</span></span><ChevronRight size={18} className="text-violet-700"/></button>
            <button type="button" onClick={() => router.push('/spending-pulse')} className="mb-3 flex min-h-16 w-full items-center justify-between gap-3 rounded-[22px] border border-teal-200/60 bg-teal-50/70 px-4 py-3 text-left transition active:scale-[0.98] dark:border-teal-800/50 dark:bg-teal-900/20">
              <span className="min-w-0"><span className="block text-[13px] font-bold text-teal-800 dark:text-teal-200">Ritmo Financeiro</span><span className="mt-1 block text-[11px] text-teal-700/80 dark:text-teal-300/80">Comparar meses, configurar limite e identificar gastos</span></span>
              <ChevronRight size={19} className="shrink-0 text-teal-600"/>
            </button>
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

            <section className="rounded-[28px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 flex items-center gap-2">
                <Bot size={18} className="text-teal-600 dark:text-teal-400" />
                <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Bot Finance no WhatsApp</h2>
              </div>
              <p className="text-[12px] leading-5 text-gray-500 dark:text-gray-400">
                Diferente do chat Gemini acima. Use seu número já vinculado ao Finance para consultar e preparar lançamentos por mensagem.
              </p>
              <div className="mt-3 space-y-2 rounded-[18px] bg-gray-50 p-3 dark:bg-slate-800/70">
                <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">Exemplos de mensagens</p>
                <p className="text-[12px] text-gray-600 dark:text-gray-300">• gastei 45 no posto pela Nubank</p>
                <p className="text-[12px] text-gray-600 dark:text-gray-300">• pendências novembro empresa</p>
                <p className="text-[12px] text-gray-600 dark:text-gray-300">• João me deve 150 vence 29/02/2028</p>
                <p className="text-[12px] text-gray-600 dark:text-gray-300">• assinatura streaming 45 dia 31</p>
                <p className="text-[12px] text-gray-600 dark:text-gray-300">• comparar setembro e outubro empresa
                </p><p className="text-[12px] text-gray-600 dark:text-gray-300">• evolução últimos 6 meses pessoal
                </p><p className="text-[12px] text-gray-600 dark:text-gray-300">• ajuda ou cancelar</p>
              </div>
              <p className="mt-3 text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                Revise as confirmações. Um valor a receber não vira saldo disponível só por ter sido cadastrado.
              </p>
            </section>
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
