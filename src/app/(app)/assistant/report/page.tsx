// src/app/(app)/assistant/report/page.tsx
'use client'

import {
  useMemo,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  ChevronLeft,
  Download,
  FileText,
  PieChart,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

import ContextToggle, {
  useContext_,
} from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLocalData } from '@/hooks/useLocalData'
import {
  isRealizedFinancialTransaction,
} from '@/lib/financialMetrics'
import { formatCurrency } from '@/lib/utils'

type Period = '1m' | '3m' | '6m'

const PERIOD_MONTHS: Record<Period, number> = {
  '1m': 1,
  '3m': 3,
  '6m': 6,
}

const parseCivilDate = (
  value: unknown
) => {
  const match =
    String(value || '').match(
      /^(\d{4})-(\d{2})-(\d{2})/
    )

  if (!match) return null

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  )

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date
}

export default function AssistantReportPage() {
  const router = useRouter()

  const {
    context,
    appMode,
  } = useContext_()

  const effectiveContext =
    appMode === 'personal_only'
      ? 'personal'
      : context

  const { showToast } =
    useToast()

  const {
    vibrate,
    success,
  } = useHapticFeedback()

  const [period, setPeriod] =
    useState<Period>('3m')

  const {
    data: localTransactions = [],
    loading: txLoading,
  } = useLocalData({
    table: 'transactions' as any,
    filters: {
      context: effectiveContext,
    },
  })

  const {
    data: localCategories = [],
    loading: catLoading,
  } = useLocalData({
    table: 'categories' as any,
    filters: {
      context: effectiveContext,
    },
  })

  const report = useMemo(() => {
    const now = new Date()

    const months =
      PERIOD_MONTHS[period]

    const startDate =
      startOfMonth(
        subMonths(
          now,
          months - 1
        )
      )

    const transactions =
      (localTransactions as any[])
        .filter((transaction) => {
          if (
            !isRealizedFinancialTransaction(
              transaction
            )
          ) {
            return false
          }

          const date =
            parseCivilDate(
              transaction.date
            )

          return Boolean(
            date &&
              date >= startDate &&
              date <= now
          )
        })

    const incomeTransactions =
      transactions.filter(
        (transaction) =>
          transaction.type === 'income'
      )

    const expenseTransactions =
      transactions.filter(
        (transaction) =>
          transaction.type === 'expense' ||
          transaction.type === 'sangria'
      )

    const totalIncome =
      incomeTransactions.reduce(
        (sum, transaction) =>
          sum +
          Number(
            transaction.amount || 0
          ),
        0
      )

    const totalExpense =
      expenseTransactions.reduce(
        (sum, transaction) =>
          sum +
          Number(
            transaction.amount || 0
          ),
        0
      )

    const biggestIncome =
      incomeTransactions.reduce(
        (
          max: any,
          transaction: any
        ) =>
          Number(
            transaction.amount || 0
          ) >
          Number(
            max.amount || 0
          )
            ? transaction
            : max,
        {
          description: 'Nenhuma',
          amount: 0,
          date: '',
        }
      )

    const biggestExpense =
      expenseTransactions.reduce(
        (
          max: any,
          transaction: any
        ) =>
          Number(
            transaction.amount || 0
          ) >
          Number(
            max.amount || 0
          )
            ? transaction
            : max,
        {
          description: 'Nenhuma',
          amount: 0,
          date: '',
        }
      )

    const categoryNames =
      new Map<string, any>(
        (localCategories as any[])
          .map((category) => [
            category.id,
            category,
          ])
      )

    const categoryMap =
      new Map<
        string,
        {
          name: string
          amount: number
          color: string
        }
      >()

    for (
      const transaction
      of expenseTransactions
    ) {
      const categoryId =
        transaction.category_id ||
        'uncategorized'

      const category =
        categoryNames.get(
          categoryId
        )

      const current =
        categoryMap.get(
          categoryId
        ) || {
          name:
            category?.name ||
            'Sem categoria',
          amount: 0,
          color:
            category?.color ||
            '#64748b',
        }

      current.amount +=
        Number(
          transaction.amount || 0
        )

      categoryMap.set(
        categoryId,
        current
      )
    }

    const categoryBreakdown =
      [...categoryMap.values()]
        .map((category) => ({
          ...category,
          percent:
            totalExpense > 0
              ? (
                  category.amount /
                  totalExpense
                ) * 100
              : 0,
        }))
        .sort(
          (a, b) =>
            b.amount - a.amount
        )
        .slice(0, 6)

    const monthlyMap =
      new Map<
        string,
        {
          income: number
          expense: number
        }
      >()

    for (
      let index = months - 1;
      index >= 0;
      index--
    ) {
      const date =
        subMonths(
          now,
          index
        )

      const key =
        format(
          date,
          'yyyy-MM'
        )

      monthlyMap.set(
        key,
        {
          income: 0,
          expense: 0,
        }
      )
    }

    for (
      const transaction
      of transactions
    ) {
      const date =
        parseCivilDate(
          transaction.date
        )

      if (!date) continue

      const key =
        format(
          date,
          'yyyy-MM'
        )

      const current =
        monthlyMap.get(
          key
        )

      if (!current) continue

      if (
        transaction.type === 'income'
      ) {
        current.income +=
          Number(
            transaction.amount || 0
          )
      } else {
        current.expense +=
          Number(
            transaction.amount || 0
          )
      }
    }

    const monthlyTrend =
      [...monthlyMap.entries()]
        .map(
          ([key, values]) => {
            const [
              year,
              month,
            ] = key.split('-')

            const date =
              new Date(
                Number(year),
                Number(month) - 1,
                1
              )

            return {
              month:
                format(
                  date,
                  'MMM/yy',
                  {
                    locale: ptBR,
                  }
                ),
              income:
                values.income,
              expense:
                values.expense,
              balance:
                values.income -
                values.expense,
            }
          }
        )

    const elapsedDays =
      Math.max(
        1,
        Math.floor(
          (
            now.getTime() -
            startDate.getTime()
          ) /
            86_400_000
        ) + 1
      )

    const insights: Array<{
      type:
        | 'positive'
        | 'negative'
        | 'neutral'
      message: string
    }> = []

    const net =
      totalIncome -
      totalExpense

    if (net > 0) {
      insights.push({
        type: 'positive',
        message:
          `O período fechou positivo em ${formatCurrency(net)}.`,
      })
    } else if (net < 0) {
      insights.push({
        type: 'negative',
        message:
          `As despesas superaram as receitas em ${formatCurrency(Math.abs(net))}.`,
      })
    } else {
      insights.push({
        type: 'neutral',
        message:
          'Receitas e despesas ficaram equilibradas no período.',
      })
    }

    if (
      biggestExpense.amount > 0
    ) {
      insights.push({
        type: 'neutral',
        message:
          `Maior despesa: ${biggestExpense.description} — ${formatCurrency(biggestExpense.amount)}.`,
      })
    }

    if (
      categoryBreakdown[0]
    ) {
      insights.push({
        type: 'neutral',
        message:
          `Categoria com maior gasto: ${categoryBreakdown[0].name}, com ${categoryBreakdown[0].percent.toFixed(0)}% das despesas do período.`,
      })
    }

    return {
      summary: {
        totalIncome,
        totalExpense,
        balance: net,
        transactionCount:
          transactions.length,
        incomeCount:
          incomeTransactions.length,
        expenseCount:
          expenseTransactions.length,
        averageDaily:
          net / elapsedDays,
        biggestIncome,
        biggestExpense,
      },
      categoryBreakdown,
      monthlyTrend,
      insights,
      generatedAt:
        new Date().toISOString(),
    }
  }, [
    localCategories,
    localTransactions,
    period,
  ])

  const exportCsv = () => {
    vibrate([8])

    const rows = [
      ['Relatório financeiro'],
      [
        'Contexto',
        effectiveContext,
      ],
      [
        'Período',
        period,
      ],
      [
        'Gerado em',
        report.generatedAt,
      ],
      [],
      ['Resumo'],
      [
        'Receitas',
        report.summary
          .totalIncome
          .toFixed(2),
      ],
      [
        'Despesas',
        report.summary
          .totalExpense
          .toFixed(2),
      ],
      [
        'Resultado',
        report.summary
          .balance
          .toFixed(2),
      ],
      [
        'Transações',
        String(
          report.summary
            .transactionCount
        ),
      ],
      [],
      [
        'Categorias',
        'Valor',
        'Percentual',
      ],
      ...report.categoryBreakdown
        .map((category) => [
          category.name,
          category.amount
            .toFixed(2),
          category.percent
            .toFixed(2),
        ]),
      [],
      [
        'Mês',
        'Receitas',
        'Despesas',
        'Resultado',
      ],
      ...report.monthlyTrend
        .map((month) => [
          month.month,
          month.income
            .toFixed(2),
          month.expense
            .toFixed(2),
          month.balance
            .toFixed(2),
        ]),
    ]

    const escapeCell = (
      value: unknown
    ) => {
      const text =
        String(
          value ?? ''
        )

      return `"${text.replace(
        /"/g,
        '""'
      )}"`
    }

    const csv =
      rows
        .map((row) =>
          row
            .map(escapeCell)
            .join(';')
        )
        .join('\n')

    const blob =
      new Blob(
        [
          '\ufeff' +
          csv,
        ],
        {
          type:
            'text/csv;charset=utf-8;',
        }
      )

    const url =
      URL.createObjectURL(
        blob
      )

    const anchor =
      document.createElement(
        'a'
      )

    anchor.href = url

    anchor.download =
      `relatorio-financeiro-${format(
        new Date(),
        'yyyy-MM-dd'
      )}.csv`

    document.body
      .appendChild(anchor)

    anchor.click()
    anchor.remove()

    URL.revokeObjectURL(url)

    success()

    showToast(
      'Relatório CSV exportado.',
      'success'
    )
  }

  const loading =
    txLoading ||
    catLoading

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f8f9fa] px-4 pb-28 pt-4 font-sans dark:bg-slate-900">
      <div className="sticky top-0 z-30 pb-3">
        <div className="rounded-[24px] border border-gray-200/70 bg-white/95 px-4 py-4 shadow-sm backdrop-blur-xl dark:border-slate-700 dark:bg-slate-800/95">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-600 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-[20px] font-semibold tracking-tight text-gray-800 dark:text-gray-100">
                  <FileText
                    size={20}
                    className="text-teal-600"
                  />
                  Relatório financeiro
                </h1>

                <p className="mt-0.5 text-[12px] text-gray-400 dark:text-gray-500">
                  Métricas locais do período selecionado
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={exportCsv}
              disabled={loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-500 active:scale-[0.98] disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300"
              title="Exportar CSV"
            >
              <Download size={18} />
            </button>
          </div>

          <ContextToggle />

          <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {[
              {
                key: '1m',
                label: '1 mês',
              },
              {
                key: '3m',
                label: '3 meses',
              },
              {
                key: '6m',
                label: '6 meses',
              },
            ].map((item) => (
              <button
                type="button"
                key={item.key}
                onClick={() => {
                  vibrate([4])
                  setPeriod(
                    item.key as Period
                  )
                }}
                className={`h-10 shrink-0 whitespace-nowrap rounded-[18px] border px-3.5 text-[13px] font-semibold active:scale-[0.98] ${
                  period === item.key
                    ? 'border-transparent bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                    : 'border-gray-200/70 bg-white text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-28 rounded-[24px] border border-gray-200/70 bg-white dark:border-slate-700 dark:bg-slate-800"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Resultado do período
                </p>

                <p className="text-[30px] font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100">
                  {formatCurrency(
                    report.summary.balance
                  )}
                </p>

                <p className="mt-2 text-[12px] text-gray-400 dark:text-gray-500">
                  {
                    report.summary
                      .transactionCount
                  }{' '}
                  movimentações realizadas
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-teal-50 dark:bg-teal-900/20">
                <RefreshCw
                  size={19}
                  className="text-teal-600 dark:text-teal-400"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[18px] border border-gray-200/70 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[12px] text-gray-400">
                  Transações
                </p>

                <p className="mt-1 text-[16px] font-semibold text-gray-900 dark:text-gray-100">
                  {
                    report.summary
                      .transactionCount
                  }
                </p>
              </div>

              <div className="rounded-[18px] border border-gray-200/70 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-[12px] text-gray-400">
                  Média diária
                </p>

                <p
                  className={`mt-1 text-[16px] font-semibold ${
                    report.summary
                      .averageDaily >= 0
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-red-500 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(
                    report.summary
                      .averageDaily
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[24px] border border-gray-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[14px] bg-emerald-50 dark:bg-emerald-900/20">
                <TrendingUp
                  size={16}
                  className="text-emerald-600 dark:text-emerald-400"
                />
              </div>

              <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                Receitas
              </p>

              <p className="mt-1 text-[16px] font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(
                  report.summary
                    .totalIncome
                )}
              </p>

              <p className="mt-1 text-[12px] text-gray-400">
                {
                  report.summary
                    .incomeCount
                }{' '}
                transações
              </p>
            </div>

            <div className="rounded-[24px] border border-gray-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[14px] bg-red-50 dark:bg-red-900/20">
                <TrendingDown
                  size={16}
                  className="text-red-500 dark:text-red-400"
                />
              </div>

              <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                Despesas
              </p>

              <p className="mt-1 text-[16px] font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(
                  report.summary
                    .totalExpense
                )}
              </p>

              <p className="mt-1 text-[12px] text-gray-400">
                {
                  report.summary
                    .expenseCount
                }{' '}
                transações
              </p>
            </div>
          </div>

          {report.categoryBreakdown
            .length > 0 && (
            <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                <PieChart
                  size={18}
                  className="text-teal-600"
                />
                Categorias com mais gastos
              </h2>

              <div className="space-y-2.5">
                {report.categoryBreakdown.map(
                  (category) => (
                    <div
                      key={category.name}
                      className="rounded-[18px] border border-gray-200/70 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-[13px] font-medium text-gray-700 dark:text-gray-300">
                          {category.name}
                        </span>

                        <span className="shrink-0 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(
                            category.amount
                          )}
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width:
                              `${Math.min(
                                100,
                                category.percent
                              )}%`,
                            backgroundColor:
                              category.color,
                          }}
                        />
                      </div>

                      <span className="mt-1 inline-block text-[11px] text-gray-400">
                        {category.percent.toFixed(
                          0
                        )}
                        %
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-gray-800 dark:text-gray-100">
              <BarChart3
                size={18}
                className="text-teal-600"
              />
              Evolução mensal
            </h2>

            <div className="space-y-2">
              {report.monthlyTrend.map(
                (month) => (
                  <div
                    key={month.month}
                    className="rounded-[18px] border border-gray-200/70 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">
                        {month.month}
                      </span>

                      <span
                        className={`text-[13px] font-semibold ${
                          month.balance >= 0
                            ? 'text-teal-600 dark:text-teal-400'
                            : 'text-red-500 dark:text-red-400'
                        }`}
                      >
                        {formatCurrency(
                          month.balance
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[12px]">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +
                        {formatCurrency(
                          month.income
                        )}
                      </span>

                      <span className="text-red-500 dark:text-red-400">
                        -
                        {formatCurrency(
                          month.expense
                        )}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {report.insights.length >
            0 && (
            <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                Leitura automática
              </h2>

              <div className="space-y-2">
                {report.insights.map(
                  (insight, index) => (
                    <div
                      key={`${insight.type}-${index}`}
                      className={`rounded-[18px] border p-3 ${
                        insight.type ===
                        'positive'
                          ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/20'
                          : insight.type ===
                              'negative'
                            ? 'border-red-100 bg-red-50 dark:border-red-900/30 dark:bg-red-900/20'
                            : 'border-gray-200/70 bg-gray-50 dark:border-slate-700 dark:bg-slate-900'
                      }`}
                    >
                      <p className="text-[13px] leading-relaxed text-gray-800 dark:text-gray-200">
                        {insight.message}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          <p className="px-2 text-center text-[11px] leading-5 text-gray-400 dark:text-gray-500">
            O relatório considera somente movimentações financeiras realizadas que afetam saldo e respeita o contexto selecionado.
          </p>
        </div>
      )}
    </div>
  )
}
