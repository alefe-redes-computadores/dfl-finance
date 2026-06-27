'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ReportFilters, { ReportFilterValues } from './ReportFilters'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'

const COLORS = ['#14b8a6', '#f97316', '#8b5cf6', '#ef4444', '#3b82f6', '#eab308', '#ec4899', '#22c55e', '#64748b', '#000000']

export default function CategoryResult() {
  const { user } = useAuth()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ReportFilterValues | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const loadData = useCallback(async (f: ReportFilterValues) => {
    if (!user) return
    setLoading(true)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .gte('date', f.dateRange.start)
      .lte('date', f.dateRange.end)

    const txs = Array.isArray(transactions) ? transactions : []

    // Agrupar por categoria (apenas despesas)
    const catMap: Record<string, number> = {}
    txs
      .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
      .forEach((t: any) => {
        const name = t.categories?.name || 'Outros'
        catMap[name] = (catMap[name] || 0) + Number(t.amount || 0)
      })

    const chartData = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

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
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Gastos por Categoria</h3>
        {data.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Nenhum dado no período.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  onClick={(e) => setSelectedCategory(e.name)}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>

            {/* Lista detalhada */}
            <div className="mt-4 space-y-2">
              {data.map((item, index) => (
                <div
                  key={item.name}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                    selectedCategory === item.name
                      ? 'bg-teal-50 dark:bg-teal-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                  }`}
                  onClick={() => setSelectedCategory(selectedCategory === item.name ? null : item.name)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      R$ {item.value.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {((item.value / total) * 100).toFixed(1)}%
                    </p>
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