// src/app/(app)/assistant/page.tsx
'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  Calendar,
  ChevronLeft,
  FileText,
  MessageSquare,
  PieChart,
  Settings,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react'

import ContextToggle, {
  ContextProvider,
  useContext_,
} from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { useUserSettings } from '@/hooks/useUserSettings'
import {
  isRealizedFinancialTransaction,
} from '@/lib/financialMetrics'
import { formatCurrency } from '@/lib/utils'

const AssistantSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="h-40 rounded-[24px] border border-gray-200/70 bg-white dark:border-slate-700 dark:bg-slate-800" />

    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="h-28 rounded-[24px] border border-gray-200/70 bg-white dark:border-slate-700 dark:bg-slate-800"
        />
      ))}
    </div>

    <div className="h-48 rounded-[24px] border border-gray-200/70 bg-white dark:border-slate-700 dark:bg-slate-800" />
  </div>
)

function AssistantContent() {
  const router = useRouter()

  const {
    context,
    appMode,
  } = useContext_()

  const effectiveContext =
    appMode === 'personal_only'
      ? 'personal'
      : context

  const {
    settings,
    loading: settingsLoading,
  } = useUserSettings()

  const aiEnabled =
    settings?.preferences.ai_enabled ?? true

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

  const {
    data: localAccounts = [],
    loading: accountsLoading,
  } = useLocalData({
    table: 'accounts' as any,
    filters: {
      context: effectiveContext,
    },
  })

  const dashboard = useMemo(() => {
    const now = new Date()

    const monthPrefix =
      `${now.getFullYear()}-` +
      `${String(now.getMonth() + 1).padStart(2, '0')}`

    const realized =
      (localTransactions as any[])
        .filter((transaction) =>
          isRealizedFinancialTransaction(
            transaction
          )
        )

    const currentMonth =
      realized.filter((transaction) =>
        String(
          transaction.date || ''
        ).startsWith(monthPrefix)
      )

    const income =
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

    const expense =
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

    for (const transaction of currentMonth) {
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

    const biggestCategory =
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
        )[0] || null

    return {
      accountBalance,
      income,
      expense,
      net:
        income - expense,
      transactionCount:
        currentMonth.length,
      categoriesCount:
        categoryTotals.size,
      biggestCategory,
    }
  }, [
    localAccounts,
    localCategories,
    localTransactions,
  ])

  const loading =
    txLoading ||
    catLoading ||
    accountsLoading ||
    settingsLoading

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#f8f9fa] pb-28 font-sans dark:bg-slate-900">
      <div className="sticky top-0 z-40 border-b border-gray-200/60 bg-[#f8f9fa]/92 px-4 pb-3 pt-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/92">
        <div className="rounded-[24px] border border-gray-200/70 bg-white/90 px-4 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/90">
          <div className="mb-3 flex items-start justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                router.push('/more')
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-500 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300"
              aria-label="Voltar"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="min-w-0 flex-1 text-center">
              <div className="inline-flex items-center gap-2">
                <Bot
                  size={20}
                  className="text-teal-600"
                />

                <h1 className="text-[20px] font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Assistente financeiro
                </h1>
              </div>

              <p className="mt-1 text-[12px] text-gray-400 dark:text-gray-500">
                Dados reais do contexto selecionado
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  '/assistant/settings'
                )
              }
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-gray-200/70 bg-gray-50 text-gray-500 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-300"
              aria-label="Configurações do Assistente"
            >
              <Settings size={18} />
            </button>
          </div>

          <ContextToggle />
        </div>
      </div>

      <div className="space-y-4 px-4 pt-3">
        {loading ? (
          <AssistantSkeleton />
        ) : (
          <>
            {!aiEnabled && (
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
                  Assistente desativado
                </p>

                <p className="mt-1 text-[12px] leading-5 text-amber-700 dark:text-amber-400">
                  Os indicadores locais continuam disponíveis. O Chat fica bloqueado até você habilitar o Assistente nas configurações.
                </p>
              </div>
            )}

            <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mb-1 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                    Saldo das contas
                  </p>

                  <p className="text-[30px] font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100">
                    {formatCurrency(
                      dashboard.accountBalance
                    )}
                  </p>

                  <p className="mt-2 text-[12px] text-gray-400 dark:text-gray-500">
                    Soma dos saldos cadastrados neste contexto
                  </p>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-teal-50 dark:bg-teal-900/20">
                  <Wallet
                    size={20}
                    className="text-teal-600 dark:text-teal-400"
                  />
                </div>
              </div>

              <div className="mt-4 rounded-[18px] border border-gray-200/70 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-gray-500 dark:text-gray-400">
                    Resultado do mês
                  </span>

                  <span
                    className={`text-[14px] font-semibold ${
                      dashboard.net >= 0
                        ? 'text-teal-600 dark:text-teal-400'
                        : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {formatCurrency(
                      dashboard.net
                    )}
                  </span>
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
                  Receitas do mês
                </p>

                <p className="mt-1 text-[17px] font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(
                    dashboard.income
                  )}
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
                  Despesas do mês
                </p>

                <p className="mt-1 text-[17px] font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(
                    dashboard.expense
                  )}
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[14px] bg-blue-50 dark:bg-blue-900/20">
                  <Calendar
                    size={16}
                    className="text-blue-600 dark:text-blue-400"
                  />
                </div>

                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Movimentações
                </p>

                <p className="mt-1 text-[17px] font-semibold text-gray-900 dark:text-gray-100">
                  {dashboard.transactionCount}
                </p>
              </div>

              <div className="rounded-[24px] border border-gray-200/70 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[14px] bg-orange-50 dark:bg-orange-900/20">
                  <PieChart
                    size={16}
                    className="text-orange-600 dark:text-orange-400"
                  />
                </div>

                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                  Categorias usadas
                </p>

                <p className="mt-1 text-[17px] font-semibold text-gray-900 dark:text-gray-100">
                  {dashboard.categoriesCount}
                </p>
              </div>
            </div>

            {dashboard.biggestCategory && (
              <div className="rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-1 flex items-center gap-2">
                  <PieChart
                    size={17}
                    className="text-orange-500"
                  />

                  <h2 className="text-[15px] font-semibold text-gray-800 dark:text-gray-100">
                    Maior categoria de despesa do mês
                  </h2>
                </div>

                <p className="mt-3 text-[22px] font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  {dashboard.biggestCategory.name}
                </p>

                <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
                  {formatCurrency(
                    dashboard.biggestCategory.amount
                  )}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (aiEnabled) {
                    router.push('/assistant/chat')
                  } else {
                    router.push('/assistant/settings')
                  }
                }}
                className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-teal-50 dark:bg-teal-900/20">
                  <MessageSquare
                    size={24}
                    className="text-teal-600 dark:text-teal-400"
                  />
                </div>

                <div className="text-center">
                  <span className="block text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                    Chat
                  </span>

                  <span className="mt-1 block text-[11px] leading-4 text-gray-400 dark:text-gray-500">
                    {aiEnabled
                      ? 'Pergunte sobre seu resumo financeiro'
                      : 'Ative o Assistente para conversar'}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push('/assistant/report')
                }
                className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-gray-200/70 bg-white p-5 shadow-sm transition-colors active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-indigo-50 dark:bg-indigo-900/20">
                  <FileText
                    size={24}
                    className="text-indigo-600 dark:text-indigo-400"
                  />
                </div>

                <div className="text-center">
                  <span className="block text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                    Relatório
                  </span>

                  <span className="mt-1 block text-[11px] leading-4 text-gray-400 dark:text-gray-500">
                    Resumo financeiro determinístico
                  </span>
                </div>
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
