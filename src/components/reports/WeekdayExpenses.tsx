// src/components/reports/WeekdayExpenses.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Download } from 'lucide-react'
import { BlobProvider } from '@react-pdf/renderer'
import { ReportFilterValues } from './ReportFilters'
import ReportPDF from '@/components/reports/ReportPDF'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useReportTransactions } from '@/hooks/useReportTransactions'
import { safeNumber } from '@/lib/safe'

const WEEKDAYS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
]

const COLORS = [
  '#6C5CE7',
  '#00B894',
  '#0984E3',
  '#FDCB6E',
  '#E17055',
  '#E84393',
  '#636E72',
]

interface WeekdayExpensesProps {
  filters: ReportFilterValues
}

function isExpense(transaction: any) {
  return transaction?.type === 'expense' || transaction?.type === 'sangria'
}

function getLocalWeekday(value: unknown) {
  if (typeof value !== 'string') return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  )

  return Number.isNaN(date.getTime()) ? null : date.getDay()
}

export default function WeekdayExpenses({
  filters,
}: WeekdayExpensesProps) {
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { start, end } = filters.dateRange
  const {
    context,
    tags = [],
    accounts = [],
    creditCards = [],
  } = filters

  const {
    data: reportTransactions,
    loading,
  } = useReportTransactions({
    context,
    startDate: start,
    endDate: end,
    tags,
    accounts,
    creditCards,
  })

  const transactions = useMemo(
    () =>
      reportTransactions
        .filter((transaction: any) => isExpense(transaction))
        .map((transaction: any) => ({
          ...transaction,
          amountValue: safeNumber(transaction.amount),
        })),
    [reportTransactions]
  )

  const data = useMemo(() => {
    const weekdayTotals = transactions.reduce<
      Record<number, { total: number; count: number }>
    >((acc, transaction: any) => {
      const day = getLocalWeekday(transaction.date)
      if (day === null) return acc

      if (!acc[day]) {
        acc[day] = { total: 0, count: 0 }
      }

      acc[day].total += transaction.amountValue
      acc[day].count += 1
      return acc
    }, {})

    return WEEKDAYS.map((name, index) => ({
      name,
      total: weekdayTotals[index]?.total || 0,
      count: weekdayTotals[index]?.count || 0,
    }))
  }, [transactions])

  const max = Math.max(
    ...data.map((day) => day.total),
    1
  )

  const totalExpense = transactions.reduce(
    (sum: number, transaction: any) =>
      sum + transaction.amountValue,
    0
  )

  return (
    <div className="flex-1 animate-in fade-in duration-300">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-[18px] flex items-center justify-center mb-3">
            <CalendarDays size={24} className="text-gray-400" />
          </div>
          <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">
            Sem despesas no período
          </p>
          <p className="text-sm font-medium text-gray-400">
            Nenhum registro realizado encontrado para os filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <h3 className="font-bold text-[14px] text-gray-800 dark:text-gray-200 mb-5">
              Gastos por Dia
            </h3>

            <div className="space-y-4">
              {data.map((day, index) => (
                <div key={day.name} className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {day.name}
                    </span>
                    <span className="font-black text-[14px] text-gray-800 dark:text-gray-200">
                      R$ {day.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      {day.count > 0 && (
                        <span className="text-[11px] font-bold text-gray-400 ml-1">
                          ({day.count})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="bg-gray-100 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${(day.total / max) * 100}%`,
                        backgroundColor: COLORS[index],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {transactions.length > 0 && (
            <BlobProvider
              document={
                <ReportPDF
                  title="Despesas por Dia da Semana"
                  period={`${start} a ${end}`}
                  income={0}
                  expense={totalExpense}
                  balance={-totalExpense}
                  transactions={transactions}
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
