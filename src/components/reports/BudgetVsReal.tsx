// src/components/reports/BudgetVsReal.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle, Download, Target } from 'lucide-react'
import { BlobProvider } from '@react-pdf/renderer'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import ReportPDF from '@/components/reports/ReportPDF'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useReportTransactions } from '@/hooks/useReportTransactions'
import {
  calculateBudgetMetrics,
  getBudgetCycle,
  getBudgetCycleLabel,
} from '@/lib/budgetOperations'
import { safeNumber } from '@/lib/safe'

interface BudgetVsRealProps {
  filters: ReportFilterValues
}

function isExpense(transaction: any) {
  return transaction?.type === 'expense' || transaction?.type === 'sangria'
}

function parseLocalDate(value?: string | null) {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!match) return null

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  )
}

function normalizeContext(context?: string | null) {
  if (context === 'personal' || context === 'dfl') return context
  return undefined
}

export default function BudgetVsReal({ filters }: BudgetVsRealProps) {
  const { user } = useAuth()
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { start, end } = filters.dateRange
  const { context, tags = [], accounts = [], creditCards = [] } = filters
  const effectiveContext = normalizeContext(context)

  const budgets = useLiveQuery(async () => {
    if (!user?.id) return []

    const rows = await db.budgets.where('user_id').equals(user.id).toArray()

    return effectiveContext
      ? rows.filter((budget: any) => budget.context === effectiveContext)
      : rows
  }, [user?.id, effectiveContext])

  const categories = useLiveQuery(async () => {
    if (!user?.id) return []

    return db.categories.where('user_id').equals(user.id).toArray()
  }, [user?.id])

  const referenceDate = useMemo(() => parseLocalDate(end), [end])

  const historyStart = useMemo(() => {
    if (!referenceDate || !budgets?.length) return start || null

    const starts = budgets.map((budget: any) => {
      if (budget.accumulate && budget.created_at) {
        return String(budget.created_at).slice(0, 10)
      }

      return getBudgetCycle(referenceDate, budget.period).startISO
    })

    if (start) starts.push(start)

    return starts.filter(Boolean).sort()[0] || start || null
  }, [budgets, referenceDate, start])

  const {
    data: historicalTransactions,
    loading: historicalLoading,
  } = useReportTransactions({
    context,
    startDate: historyStart,
    endDate: end,
    tags,
    accounts,
    creditCards,
  })

  const {
    data: selectedTransactions,
    loading: selectedLoading,
  } = useReportTransactions({
    context,
    startDate: start,
    endDate: end,
    tags,
    accounts,
    creditCards,
  })

  const categoryById = useMemo(
    () =>
      new Map(
        (categories || []).map((category: any) => [
          category.id,
          category.name || 'Outros',
        ])
      ),
    [categories]
  )

  const normalizedBudgets = useMemo(
    () =>
      (budgets || []).map((budget: any) => ({
        ...budget,
        categoryLabel:
          budget.category ||
          budget.categories?.name ||
          categoryById.get(budget.category_id) ||
          'Todas as categorias',
      })),
    [budgets, categoryById]
  )

  const comparison = useMemo(() => {
    if (!referenceDate) return []

    return normalizedBudgets.map((budget: any) => {
      const metrics = calculateBudgetMetrics({
        budget,
        transactions: historicalTransactions,
        referenceDate,
      })

      return {
        ...budget,
        metrics,
        spent: metrics.spent,
        limit: metrics.availableAmount,
        percentUsed: metrics.progressPercent,
        status: metrics.isOverBudget
          ? 'exceeded'
          : metrics.isWarning
            ? 'warning'
            : 'ok',
        cycleLabel: getBudgetCycleLabel(referenceDate, budget.period),
      }
    })
  }, [normalizedBudgets, historicalTransactions, referenceDate])

  const selectedExpenses = useMemo(
    () =>
      selectedTransactions
        .filter((transaction: any) => isExpense(transaction))
        .map((transaction: any) => ({
          ...transaction,
          amountValue: safeNumber(transaction.amount),
          categoryLabel: transaction.categoryLabel || 'Outros',
        })),
    [selectedTransactions]
  )

  const unbudgeted = useMemo(() => {
    const hasGlobalBudget = normalizedBudgets.some(
      (budget: any) => !budget.category_id
    )

    if (hasGlobalBudget) return []

    const budgetedCategoryIds = new Set(
      normalizedBudgets
        .map((budget: any) => budget.category_id)
        .filter(Boolean)
    )

    const grouped = selectedExpenses
      .filter(
        (transaction: any) =>
          !budgetedCategoryIds.has(transaction.category_id)
      )
      .reduce((acc: Record<string, number>, transaction: any) => {
        const category = transaction.categoryLabel
        acc[category] = (acc[category] || 0) + transaction.amountValue
        return acc
      }, {})

    return Object.entries(grouped).sort(
      (a, b) => Number(b[1]) - Number(a[1])
    )
  }, [normalizedBudgets, selectedExpenses])

  const totalExpense = selectedExpenses.reduce(
    (sum: number, transaction: any) =>
      sum + transaction.amountValue,
    0
  )

  const loading =
    budgets === undefined ||
    categories === undefined ||
    historicalLoading ||
    selectedLoading

  return (
    <div className="flex-1 animate-in fade-in duration-300">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comparison.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-[18px] flex items-center justify-center mb-3">
            <Target size={24} className="text-gray-400" />
          </div>
          <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">
            Nenhum orçamento definido
          </p>
          <p className="text-sm font-medium text-gray-400">
            Crie orçamentos em "Mais" para acompanhar aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {comparison.map((item: any) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50"
              >
                <div className="flex justify-between items-start gap-3 mb-3">
                  <div className="flex items-start gap-2 min-w-0">
                    {item.status === 'exceeded' ? (
                      <div className="bg-red-50 dark:bg-red-500/10 p-1.5 rounded-lg shrink-0">
                        <AlertTriangle size={16} className="text-red-500" />
                      </div>
                    ) : item.status === 'warning' ? (
                      <div className="bg-orange-50 dark:bg-orange-500/10 p-1.5 rounded-lg shrink-0">
                        <AlertTriangle size={16} className="text-orange-500" />
                      </div>
                    ) : (
                      <div className="bg-emerald-50 dark:bg-emerald-500/10 p-1.5 rounded-lg shrink-0">
                        <CheckCircle size={16} className="text-emerald-500" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <h4 className="font-bold text-[14px] text-gray-800 dark:text-gray-200 truncate">
                        {item.categoryLabel}
                      </h4>
                      <p className="text-[10px] font-bold text-gray-400 mt-0.5 capitalize">
                        {item.cycleLabel}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[12px] font-black px-2.5 py-1 rounded-full shrink-0 ${
                      item.status === 'exceeded'
                        ? 'bg-red-50 dark:bg-red-500/10 text-red-600'
                        : item.status === 'warning'
                          ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                          : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                    }`}
                  >
                    {item.metrics.percent.toFixed(0)}% Utilizado
                  </span>
                </div>

                <div className="bg-gray-100 dark:bg-slate-700 rounded-full h-2 mb-3 overflow-hidden shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      item.status === 'exceeded'
                        ? 'bg-red-500'
                        : item.status === 'warning'
                          ? 'bg-orange-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${item.percentUsed}%` }}
                  />
                </div>

                <div className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/30 p-2.5 rounded-[16px]">
                  <div className="text-center flex-1 border-r border-gray-200 dark:border-slate-600">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                      Gasto
                    </p>
                    <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                      R$ {item.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="text-center flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
                      Disponível
                    </p>
                    <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                      R$ {item.limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {unbudgeted.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20 rounded-[24px] p-5 mt-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-orange-500" />
                <h4 className="text-[13px] font-bold text-orange-700 dark:text-orange-400">
                  Gastos sem orçamento definido
                </h4>
              </div>

              <div className="space-y-2">
                {unbudgeted.map(([category, total]) => (
                  <div
                    key={category}
                    className="flex justify-between items-center text-[12px]"
                  >
                    <span className="font-medium text-orange-600/80 dark:text-orange-400/80">
                      {category}
                    </span>
                    <span className="font-bold text-orange-700 dark:text-orange-400">
                      R$ {Number(total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedExpenses.length > 0 && (
            <BlobProvider
              document={
                <ReportPDF
                  title="Orçamento vs Realizado"
                  period={`${start} a ${end}`}
                  income={0}
                  expense={totalExpense}
                  balance={-totalExpense}
                  transactions={selectedExpenses}
                />
              }
            >
              {({ url, loading: pdfLoading }: any) => (
                <button
                  type="button"
                  onClick={() => {
                    vibrate([10])
                    if (url && isClient) {
                      success()
                      window.open(url, '_blank', 'noopener,noreferrer')
                    }
                  }}
                  disabled={pdfLoading}
                  className="w-full mt-2 bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[20px] font-bold text-[14px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 disabled:opacity-50 active:scale-[0.98]"
                >
                  <Download size={18} />
                  {pdfLoading ? 'Gerando PDF...' : 'Exportar Relatório Completo'}
                </button>
              )}
            </BlobProvider>
          )}
        </div>
      )}
    </div>
  )
}
