'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Loader2 } from 'lucide-react'

export default function BudgetVsReal() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ReportFilterValues>({
    context,
    dateRange: { start: '', end: '' },
    preset: 'thisMonth',
  })

  const loadData = useCallback(async (f: ReportFilterValues) => {
    if (!user || !f.dateRange.start || !f.dateRange.end) return
    setLoading(true)

    const { data: budgets } = await supabase
      .from('budgets')
      .select('*, categories(name)')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .lte('month', f.dateRange.end)
      .gte('month', f.dateRange.start)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .in('type', ['expense', 'sangria'])
      .gte('date', f.dateRange.start)
      .lte('date', f.dateRange.end)

    const budgetList = Array.isArray(budgets) ? budgets : []
    const txList = Array.isArray(transactions) ? transactions : []

    // Agrupa gastos reais por categoria
    const actuals: Record<string, number> = {}
    txList.forEach((tx: any) => {
      const cat = tx.categories?.name || 'Outros'
      actuals[cat] = (actuals[cat] || 0) + Number(tx.amount || 0)
    })

    // Combina orçamento e real
    const combined = budgetList.map((b: any) => ({
      name: b.categories?.name || 'Outros',
      budget: Number(b.amount || 0),
      actual: actuals[b.categories?.name || 'Outros'] || 0,
    }))

    setData(combined)
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadData(filters)
  }, [filters, loadData])

  return (
    <div className="space-y-4">
      <ReportFilters onChange={setFilters} initialPreset="thisMonth" />

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Planejado x Gasto</h3>
        
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-teal-700" size={32} />
          </div>
        ) : data.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Nenhum orçamento encontrado neste período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="budget" name="Orçamento" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Realizado" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
