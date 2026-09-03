// src/components/reports/CategoryResult.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, PieChart } from 'lucide-react'
import { BlobProvider } from '@react-pdf/renderer'
import { ReportFilterValues } from './ReportFilters'
import ReportPDF from '@/components/reports/ReportPDF'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useReportTransactions } from '@/hooks/useReportTransactions'
import { safeNumber } from '@/lib/safe'

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: '#FF6B6B',
  Transporte: '#4ECDC4',
  Moradia: '#45B7D1',
  Lazer: '#96CEB4',
  Saúde: '#FFEAA7',
  Educação: '#DDA0DD',
  Assinaturas: '#98D8C8',
  Salário: '#6C5CE7',
  Freelance: '#A8E6CF',
  Investimentos: '#FFD93D',
  Vendas: '#FF8B94',
  Serviços: '#B8A9C9',
  Outros: '#95A5A6',
  Geral: '#95A5A6',
}

interface CategoryResultProps {
  filters: ReportFilterValues
}

function isExpense(transaction: any) {
  return transaction?.type === 'expense' || transaction?.type === 'sangria'
}

export default function CategoryResult({ filters }: CategoryResultProps) {
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => setIsClient(true), [])

  const { start, end } = filters.dateRange
  const { context, tags = [], accounts = [], creditCards = [] } = filters

  const { data: reportTransactions, loading } = useReportTransactions({
    context,
    startDate: start,
    endDate: end,
    tags,
    accounts,
    creditCards,
  })

  const expenseTransactions = useMemo(
    () => reportTransactions
      .filter((t: any) => isExpense(t))
      .map((t: any) => ({
        ...t,
        amountValue: safeNumber(t.amount),
        categoryLabel: t.categoryLabel || 'Geral',
      })),
    [reportTransactions]
  )

  const categoryArray = useMemo(() => {
    const grouped = expenseTransactions.reduce((acc: Record<string, any>, t: any) => {
      const category = t.categoryLabel
      if (!acc[category]) acc[category] = { total: 0, count: 0, transactions: [] }
      acc[category].total += t.amountValue
      acc[category].count += 1
      acc[category].transactions.push(t)
      return acc
    }, {})

    return Object.entries(grouped)
      .map(([name, data]: any) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
  }, [expenseTransactions])

  const totalExpenses = categoryArray.reduce((sum, category) => sum + category.total, 0)

  return (
    <div className="flex-1 animate-in fade-in duration-300">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : categoryArray.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-3">
            <PieChart size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm font-medium">Nenhuma despesa realizada no período selecionado.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-5">Distribuição de Gastos</h3>
            <div className="space-y-3">
              {categoryArray.map((cat) => {
                const percent = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0
                const color = CATEGORY_COLORS[cat.name] || '#94a3b8'
                return (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="w-[100px] text-[12px] font-bold text-gray-600 dark:text-gray-400 truncate">{cat.name}</div>
                    <div className="flex-1 bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden shadow-inner">
                      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} />
                    </div>
                    <div className="w-[80px] text-right">
                      <p className="text-[12px] font-bold text-gray-800 dark:text-gray-200">
                        R$ {cat.total.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400">{percent.toFixed(1)}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid gap-3">
            {categoryArray.map((cat) => {
              const color = CATEGORY_COLORS[cat.name] || '#94a3b8'
              return (
                <div key={cat.name} className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-[14px] text-gray-800 dark:text-gray-200 truncate">{cat.name}</h4>
                        <p className="text-[11px] font-medium text-gray-400">
                          {cat.count} transação(ões) • {((cat.total / totalExpenses) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <p className="text-[15px] font-black text-red-500 shrink-0 ml-3">
                      R$ {cat.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="space-y-1.5 mt-2 bg-gray-50 dark:bg-slate-700/30 p-3 rounded-[16px]">
                    {cat.transactions.slice(0, 3).map((t: any) => (
                      <div key={t.id} className="flex justify-between items-center text-[12px]">
                        <span className="font-medium text-gray-600 dark:text-gray-400 truncate max-w-[70%]">{t.description || 'Sem descrição'}</span>
                        <span className="font-bold text-gray-800 dark:text-gray-300">
                          R$ {t.amountValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                    {cat.transactions.length > 3 && (
                      <p className="text-[11px] font-bold text-teal-600 text-center mt-2 pt-1 border-t border-gray-200 dark:border-slate-600">
                        + {cat.transactions.length - 3} outras transações
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {expenseTransactions.length > 0 && (
            <BlobProvider document={
              <ReportPDF
                title="Despesas por Categoria"
                period={`${start} a ${end}`}
                income={0}
                expense={totalExpenses}
                balance={-totalExpenses}
                transactions={expenseTransactions}
              />
            }>
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
