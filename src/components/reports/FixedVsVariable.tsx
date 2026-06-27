'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ReportFilters, { ReportFilterValues } from './ReportFilters'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

const COLORS = ['#14b8a6', '#f97316', '#8b5cf6', '#ef4444']

export default function FixedVsVariable() {
  const { user } = useAuth()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ReportFilterValues | null>(null)

  const loadData = useCallback(async (f: ReportFilterValues) => {
    if (!user) return
    setLoading(true)

    // Buscar assinaturas ativas (gastos fixos)
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .eq('status', 'active')

    // Buscar transações do período (gastos variáveis)
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .gte('date', f.dateRange.start)
      .lte('date', f.dateRange.end)

    const subs = Array.isArray(subscriptions) ? subscriptions : []
    const txs = Array.isArray(transactions) ? transactions : []

    // Total de gastos fixos (soma das assinaturas mensais)
    const fixedTotal = subs.reduce((acc: number, sub: any) => acc + Number(sub.amount || 0), 0)

    // Total de gastos variáveis (despesas avulsas + sangrias)
    const variableTotal = txs
      .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
      .reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0)

    // Montar dados do gráfico
    const chartData = [
      { name: 'Gastos Fixos', value: fixedTotal, color: '#14b8a6' },
      { name: 'Gastos Variáveis', value: variableTotal, color: '#f97316' },
    ]

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

  const total = data.reduce((acc, item) => acc + item.value, 0)

  return (
    <div>
      <ReportFilters onChange={setFilters} initialPreset={filters.preset} />

      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Gastos Fixos vs Variáveis</h3>
        {total === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Nenhum dado no período.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            <div className="mt-4 space-y-2">
              {data.map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">R$ {item.value.toFixed(2)}</p>
                    <p className="text-[10px] text-gray-400">{((item.value / total) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}