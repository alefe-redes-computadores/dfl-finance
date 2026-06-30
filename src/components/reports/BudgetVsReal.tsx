'use client'

import React, { useState, useEffect } from 'react'
import { Target, AlertTriangle, CheckCircle, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { PDFDownloadLink } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'

interface BudgetVsRealProps {
  filters: ReportFilterValues
}

export default function BudgetVsReal({ filters }: BudgetVsRealProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [budgets, setBudgets] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])

  useEffect(() => {
    if (!user?.id || !filters.dateRange.start || !filters.dateRange.end) return
    setLoading(true)

    const load = async () => {
      let budgetQuery = supabase.from('budgets').select('*').eq('user_id', user.id)
      if (filters.context === 'personal') budgetQuery = budgetQuery.eq('context', 'personal')
      const { data: budgData } = await budgetQuery

      let expQuery = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
      if (filters.context === 'personal') expQuery = expQuery.eq('context', 'personal')

      // 🆕 Filtros cruzados
      if (filters.tags && filters.tags.length > 0) {
        expQuery = expQuery.overlaps('tag_ids', filters.tags)
      }
      if (filters.accounts && filters.accounts.length > 0) {
        expQuery = expQuery.in('account_id', filters.accounts)
      }
      if (filters.creditCards && filters.creditCards.length > 0) {
        expQuery = expQuery.in('credit_card_id', filters.creditCards)
      }

      const { data: expData } = await expQuery

      setBudgets(budgData || [])
      setExpenses(expData || [])
      setLoading(false)
    }

    load()
  }, [user?.id, filters])

  const expensesByCat = expenses.reduce((acc: any, e: any) => {
    const cat = e.category || 'Outros'
    acc[cat] = (acc[cat] || 0) + e.amount
    return acc
  }, {})

  const comparison = budgets.map(b => {
    const spent = expensesByCat[b.category] || 0
    const perc = b.amount > 0 ? (spent / b.amount) * 100 : 0
    return { ...b, spent, percentUsed: perc, status: perc >= 100 ? 'exceeded' : perc >= 80 ? 'warning' : 'ok' }
  })

  const budgetedCats = budgets.map(b => b.category)
  const unbudgeted = Object.entries(expensesByCat).filter(([cat]) => !budgetedCats.includes(cat))

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : comparison.length === 0 ? (
        <div className="text-center p-8 text-slate-500">
          <Target size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="font-medium mb-2">Nenhum orçamento definido</p>
          <p className="text-sm">Crie orçamentos para comparar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comparison.map(item => (
            <div key={item.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  {item.status === 'exceeded' ? <AlertTriangle size={18} className="text-red-500 mr-2" /> :
                   item.status === 'warning' ? <AlertTriangle size={18} className="text-amber-500 mr-2" /> :
                   <CheckCircle size={18} className="text-emerald-500 mr-2" />}
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">{item.category}</h4>
                </div>
                <span className={`text-sm font-bold ${item.status === 'exceeded' ? 'text-red-600' : item.status === 'warning' ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {item.percentUsed.toFixed(1)}%
                </span>
              </div>
              <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-2 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${item.status === 'exceeded' ? 'bg-red-500' : item.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(item.percentUsed, 100)}%` }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Gasto: R$ {item.spent.toFixed(2)}</span>
                <span>Orçamento: R$ {item.amount.toFixed(2)}</span>
              </div>
            </div>
          ))}
          {unbudgeted.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950 rounded-xl p-4 mt-4">
              <h4 className="text-sm font-semibold text-amber-700 mb-2">Categorias sem orçamento</h4>
              {unbudgeted.map(([cat, total]) => (
                <div key={cat} className="flex justify-between text-sm text-amber-600">
                  <span>{cat}</span>
                  <span className="font-medium">R$ {(total as number).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Botão Exportar PDF */}
          {expenses.length > 0 && (
            <PDFDownloadLink
              document={
                <ReportPDF
                  title="Orçamento vs Realizado"
                  period={`${filters.dateRange.start} a ${filters.dateRange.end}`}
                  income={0}
                  expense={expenses.reduce((a, t) => a + t.amount, 0)}
                  balance={-expenses.reduce((a, t) => a + t.amount, 0)}
                  transactions={expenses}
                />
              }
              fileName={`orcamento-vs-realizado-${Date.now()}.pdf`}
              className="w-full mt-4 bg-teal-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors flex items-center justify-center gap-2"
            >
              {({ loading: pdfLoading }: any) => (
                <>
                  <Download size={16} />
                  {pdfLoading ? 'Gerando PDF...' : 'Exportar PDF'}
                </>
              )}
            </PDFDownloadLink>
          )}
        </div>
      )}
    </div>
  )
}