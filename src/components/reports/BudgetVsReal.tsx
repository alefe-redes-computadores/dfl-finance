'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ReportFilters, { ReportFilterValues } from './ReportFilters'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

export default function BudgetVsReal() {
  const { user } = useAuth()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ReportFilterValues | null>(null)

  const loadData = useCallback(async (f: ReportFilterValues) => {
    if (!user) return
    setLoading(true)

    // Buscar transações no período
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .gte('date', f.dateRange.start)
      .lte('date', f.dateRange.end)

    // Buscar orçamentos
    const { data: budgets } = await supabase
      .from('budgets')
      .select('*, categories(name)')
      .eq('user_id', user.id)
      .eq('context', f.context)

    const txs = Array.isArray(transactions) ? transactions : []
    const bdgs = Array.isArray(budgets) ? budgets : []

    // Agrupar gastos por categoria
    const spentMap: Record<string, number> = {}
    txs
      .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
      .forEach((t: any) => {
        const catName = t.categories?.name || 'Outros'
        spentMap[catName] = (spentMap[catName] || 0) + Number(t.amount || 0)
      })

    // Montar dados para o gráfico
    const chartData = bdgs.map((b: any) => {
      const catName = b.categories?.name || 'Outros'
      return {
        name: catName,
        Orçamento: Number(b.amount || 0),
        Realizado: spentMap[catName] || 0,
      }
    })

    setData(chartData)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (filters) loadData(filters)
  }, [filters, loadData])

  if (!filters) {
    return (
      <ReportFilters
        onChange={setFilters}
        initialPreset="thisMonth"
      />
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-teal-700" size={32} />
      </div>
    )
  }

  return (
    <div>
      <ReportFilters onChange={setFilters} initialPreset={filters.preset} />
      
      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Orçamento vs Realizado</h3>
        {data.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Nenhum dado no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Orçamento" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realizado" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}