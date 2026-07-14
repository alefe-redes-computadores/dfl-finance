'use client'

import React, { useState, useEffect } from 'react'
import { Target, AlertTriangle, CheckCircle, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { BlobProvider } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { safeNumber, safeArray } from '@/lib/safe'

interface BudgetVsRealProps {
  filters: ReportFilterValues
}

export default function BudgetVsReal({ filters }: BudgetVsRealProps) {
  const { user } = useAuth()
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)
  const [loading, setLoading] = useState(true)
  const [budgets, setBudgets] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { start, end } = filters.dateRange
  const { context, tags = [], accounts = [], creditCards = [] } = filters

  useEffect(() => {
    if (!user?.id || !start || !end) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        setLoading(true)

        let budgetQuery = supabase.from('budgets').select('*').eq('user_id', user.id)
        if (context === 'personal') budgetQuery = budgetQuery.eq('context', 'personal')
        const { data: budgData } = await budgetQuery

        let expQuery = supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .gte('date', start)
          .lte('date', end)

        if (context === 'personal') expQuery = expQuery.eq('context', 'personal')
        if (tags.length > 0) expQuery = expQuery.overlaps('tag_ids', tags)
        if (accounts.length > 0) expQuery = expQuery.in('account_id', accounts)
        if (creditCards.length > 0) expQuery = expQuery.in('credit_card_id', creditCards)

        const { data: expData } = await expQuery

        setBudgets(budgData || [])
        setExpenses(expData || [])
      } catch (error) {
        console.error('Erro ao carregar orçamento vs realizado:', error)
        setBudgets([])
        setExpenses([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id, start, end, context, tags.join(','), accounts.join(','), creditCards.join(',')])

  // Normaliza
  const normalizedBudgets = (Array.isArray(budgets) ? budgets : []).map((b) => ({
    ...b,
    categoryLabel: b?.category || b?.categories?.name || 'Outros',
    limitValue: safeNumber(b?.amount),
  }))

  const normalizedExpenses = (Array.isArray(expenses) ? expenses : []).map((e) => ({
    ...e,
    categoryLabel: e?.category || e?.categories?.name || 'Outros',
    amountValue: safeNumber(e?.amount),
  }))

  // Gasto por categoria
  const expensesByCat = normalizedExpenses.reduce((acc: any, e: any) => {
    const cat = e.categoryLabel
    acc[cat] = (acc[cat] || 0) + e.amountValue
    return acc
  }, {})

  // Comparação
  const comparison = normalizedBudgets.map((b) => {
    const spent = expensesByCat[b.categoryLabel] || 0
    const limit = b.limitValue
    const perc = limit > 0 ? (spent / limit) * 100 : 0
    return {
      ...b,
      spent,
      limit,
      percentUsed: Math.min(perc, 100),
      status: perc >= 100 ? 'exceeded' : perc >= 80 ? 'warning' : 'ok',
    }
  })

  const budgetedCats = normalizedBudgets.map((b) => b.categoryLabel)
  const unbudgeted = Object.entries(expensesByCat).filter(([cat]) => !budgetedCats.includes(cat))

  const totalExpense = normalizedExpenses.reduce((s, e) => s + e.amountValue, 0)

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
          <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">Nenhum orçamento definido</p>
          <p className="text-sm font-medium text-gray-400">Crie orçamentos em "Mais" para acompanhar aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3">
            {comparison.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50"
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    {item.status === 'exceeded' ? (
                      <div className="bg-red-50 dark:bg-red-500/10 p-1.5 rounded-lg">
                        <AlertTriangle size={16} className="text-red-500" />
                      </div>
                    ) : item.status === 'warning' ? (
                      <div className="bg-orange-50 dark:bg-orange-500/10 p-1.5 rounded-lg">
                        <AlertTriangle size={16} className="text-orange-500" />
                      </div>
                    ) : (
                      <div className="bg-emerald-50 dark:bg-emerald-500/10 p-1.5 rounded-lg">
                        <CheckCircle size={16} className="text-emerald-500" />
                      </div>
                    )}
                    <h4 className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{item.categoryLabel}</h4>
                  </div>
                  <span
                    className={`text-[12px] font-black px-2.5 py-1 rounded-full ${
                      item.status === 'exceeded'
                        ? 'bg-red-50 dark:bg-red-500/10 text-red-600'
                        : item.status === 'warning'
                        ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600'
                        : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                    }`}
                  >
                    {item.percentUsed.toFixed(0)}% Utilizado
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
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Gasto</p>
                    <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                      R$ {item.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Limite</p>
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
                <h4 className="text-[13px] font-bold text-orange-700 dark:text-orange-400">Gastos sem orçamento definido</h4>
              </div>
              <div className="space-y-2">
                {unbudgeted.map(([cat, total]) => (
                  <div key={cat} className="flex justify-between items-center text-[12px]">
                    <span className="font-medium text-orange-600/80 dark:text-orange-400/80">{cat}</span>
                    <span className="font-bold text-orange-700 dark:text-orange-400">
                      R$ {(total as number).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {expenses.length > 0 && (
            <BlobProvider
              document={
                <ReportPDF
                  title="Orçamento vs Realizado"
                  period={`${start} a ${end}`}
                  income={0}
                  expense={totalExpense}
                  balance={-totalExpense}
                  transactions={expenses}
                />
              }
            >
              {({ url, loading: pdfLoading }: any) => (
                <button
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