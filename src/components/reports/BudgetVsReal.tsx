'use client'

import React, { useState, useEffect } from 'react'
import { Target, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'

interface BudgetVsRealProps {
  filters: ReportFilterValues
}

export default function BudgetVsReal({ filters }: BudgetVsRealProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [budgets, setBudgets] = useState<any[]>([])
  const [categories, setCategories] = useState<Record<string, any>>({})
  const [expenses, setExpenses] = useState<any[]>([])

  useEffect(() => {
    if (!user?.id || !filters.dateRange.start || !filters.dateRange.end) return

    let cancelled = false
    setLoading(true)

    const load = async () => {
      const [budgResult, expResult, catResult] = await Promise.all([
        supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id)
          .eq('context', filters.context),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('type', 'expense')
          .eq('context', filters.context)
          .gte('date', filters.dateRange.start)
          .lte('date', filters.dateRange.end),
        supabase
          .from('categories')
          .select('id, name, color')
          .eq('user_id', user.id),
      ])

      if (cancelled) return

      if (budgResult.error) console.error('BudgetVsReal budgets:', budgResult.error)
      if (expResult.error) console.error('BudgetVsReal expenses:', expResult.error)
      if (catResult.error) console.error('BudgetVsReal categories:', catResult.error)

      const catMap: Record<string, any> = {}
      ;(catResult.data || []).forEach((c: any) => { catMap[c.id] = c })

      setBudgets(budgResult.data || [])
      setExpenses(expResult.data || [])
      setCategories(catMap)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, filters.context, filters.dateRange.start, filters.dateRange.end])

  const fmt = (val: number) =>
    `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Agrupa despesas por category_id
  const expensesByCatId = expenses.reduce((acc: any, e: any) => {
    const key = e.category_id || '__sem_categoria__'
    acc[key] = (acc[key] || 0) + Number(e.amount)
    return acc
  }, {})

  const comparison = budgets.map(b => {
    const spent = expensesByCatId[b.category_id] || 0
    const limit = Number(b.amount)
    const perc = limit > 0 ? (spent / limit) * 100 : 0
    const catName = categories[b.category_id]?.name || b.category || 'Categoria'
    const catColor = categories[b.category_id]?.color || '#64748b'
    return {
      ...b,
      catName,
      catColor,
      spent,
      percentUsed: perc,
      status: perc >= 100 ? 'exceeded' : perc >= 80 ? 'warning' : 'ok',
    }
  })

  // Despesas sem orçamento definido
  const budgetedCatIds = new Set(budgets.map(b => b.category_id))
  const unbudgetedEntries = Object.entries(expensesByCatId).filter(
    ([catId]) => !budgetedCatIds.has(catId)
  )

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comparison.length === 0 ? (
        <div className="text-center p-8 text-slate-500 dark:text-slate-400">
          <Target size={48} className="mx-auto mb-4 text-slate-400" />
          <p className="font-medium mb-2">Nenhum orçamento definido</p>
          <p className="text-sm">Crie orçamentos para comparar com os gastos reais.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comparison.map(item => (
            <div key={item.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  {item.status === 'exceeded' ? (
                    <AlertTriangle size={18} className="text-red-500" />
                  ) : item.status === 'warning' ? (
                    <AlertTriangle size={18} className="text-amber-500" />
                  ) : (
                    <CheckCircle size={18} className="text-emerald-500" />
                  )}
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.catColor }} />
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200">{item.catName}</h4>
                </div>
                <span
                  className={`text-sm font-bold ${
                    item.status === 'exceeded'
                      ? 'text-red-600'
                      : item.status === 'warning'
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                  }`}
                >
                  {item.percentUsed.toFixed(1)}%
                </span>
              </div>
              <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.status === 'exceeded'
                      ? 'bg-red-500'
                      : item.status === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(item.percentUsed, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Gasto: {fmt(item.spent)}</span>
                <span>Orçamento: {fmt(item.amount)}</span>
              </div>
              {item.status === 'exceeded' && (
                <p className="text-xs text-red-500 mt-1 font-medium">
                  Excedeu em {fmt(item.spent - Number(item.amount))}
                </p>
              )}
            </div>
          ))}

          {unbudgetedEntries.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/50 rounded-xl p-4 mt-4 border border-amber-100 dark:border-amber-900">
              <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3">
                Gastos sem orçamento definido
              </h4>
              {unbudgetedEntries.map(([catId, total]) => (
                <div key={catId} className="flex justify-between text-sm text-amber-700 dark:text-amber-300 py-1">
                  <span>{categories[catId]?.name || 'Sem categoria'}</span>
                  <span className="font-medium">{fmt(total as number)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}