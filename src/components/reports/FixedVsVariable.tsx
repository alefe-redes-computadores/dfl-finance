// src/components/reports/FixedVsVariable.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Lock, Repeat, Scale } from 'lucide-react'
import { BlobProvider } from '@react-pdf/renderer'
import { ReportFilterValues } from './ReportFilters'
import ReportPDF from '@/components/reports/ReportPDF'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useReportTransactions } from '@/hooks/useReportTransactions'
import { safeNumber } from '@/lib/safe'

const FIXED_CATEGORIES = [
  'Moradia',
  'Assinaturas',
  'Educação',
  'Saúde',
  'Financiamento',
]

interface FixedVsVariableProps {
  filters: ReportFilterValues
}

function isExpense(transaction: any) {
  return transaction?.type === 'expense' || transaction?.type === 'sangria'
}

function isFixedTransaction(transaction: any) {
  if (typeof transaction?.is_fixed === 'boolean') {
    return transaction.is_fixed
  }

  return FIXED_CATEGORIES.includes(
    transaction?.categoryLabel || ''
  )
}

export default function FixedVsVariable({
  filters,
}: FixedVsVariableProps) {
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

  const fixed = useMemo(
    () => transactions.filter(isFixedTransaction),
    [transactions]
  )

  const variable = useMemo(
    () =>
      transactions.filter(
        (transaction: any) => !isFixedTransaction(transaction)
      ),
    [transactions]
  )

  const totalFixed = fixed.reduce(
    (sum: number, transaction: any) =>
      sum + transaction.amountValue,
    0
  )

  const totalVar = variable.reduce(
    (sum: number, transaction: any) =>
      sum + transaction.amountValue,
    0
  )

  const total = totalFixed + totalVar
  const fixedPerc = total > 0 ? (totalFixed / total) * 100 : 0
  const varPerc = total > 0 ? (totalVar / total) * 100 : 0

  return (
    <div className="flex-1 animate-in fade-in duration-300">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-3">
            <Scale size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm font-medium">
            Nenhuma despesa realizada para comparar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-[20px] border border-amber-100 dark:border-amber-500/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lock size={14} className="text-amber-600" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600/80">
                    Fixas
                  </p>
                </div>
                <p className="text-[18px] font-black text-amber-600">
                  R$ {totalFixed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] font-bold text-amber-600/60 mt-0.5">
                  {fixedPerc.toFixed(1)}% do total
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-[20px] border border-blue-100 dark:border-blue-500/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Repeat size={14} className="text-blue-600" />
                  <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600/80">
                    Variáveis
                  </p>
                </div>
                <p className="text-[18px] font-black text-blue-600">
                  R$ {totalVar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] font-bold text-blue-600/60 mt-0.5">
                  {varPerc.toFixed(1)}% do total
                </p>
              </div>
            </div>

            <div className="bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden shadow-inner flex">
              <div
                className="h-full bg-amber-500 transition-all duration-700 ease-out"
                style={{ width: `${fixedPerc}%` }}
              />
              <div
                className="h-full bg-blue-500 transition-all duration-700 ease-out"
                style={{ width: `${varPerc}%` }}
              />
            </div>

            <div className="flex justify-between px-1 mt-2 text-[10px] font-bold text-gray-400">
              <span>Fixas</span>
              <span>Variáveis</span>
            </div>
          </div>

          {fixed.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50">
              <h3 className="font-bold text-[14px] text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                Despesas Fixas ({fixed.length})
              </h3>

              <div className="space-y-2 bg-gray-50 dark:bg-slate-700/30 p-3 rounded-[16px]">
                {fixed.slice(0, 5).map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="flex justify-between items-center text-[12px]"
                  >
                    <span className="font-medium text-gray-600 dark:text-gray-400 truncate max-w-[70%]">
                      {transaction.description || 'Sem descrição'}
                    </span>
                    <span className="font-bold text-gray-800 dark:text-gray-300">
                      R$ {transaction.amountValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {variable.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50">
              <h3 className="font-bold text-[14px] text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Despesas Variáveis ({variable.length})
              </h3>

              <div className="space-y-2 bg-gray-50 dark:bg-slate-700/30 p-3 rounded-[16px]">
                {variable.slice(0, 5).map((transaction: any) => (
                  <div
                    key={transaction.id}
                    className="flex justify-between items-center text-[12px]"
                  >
                    <span className="font-medium text-gray-600 dark:text-gray-400 truncate max-w-[70%]">
                      {transaction.description || 'Sem descrição'}
                    </span>
                    <span className="font-bold text-gray-800 dark:text-gray-300">
                      R$ {transaction.amountValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {transactions.length > 0 && (
            <BlobProvider
              document={
                <ReportPDF
                  title="Despesas Fixas vs Variáveis"
                  period={`${start} a ${end}`}
                  income={0}
                  expense={total}
                  balance={-total}
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
