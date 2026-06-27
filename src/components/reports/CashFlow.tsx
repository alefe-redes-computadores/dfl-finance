'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ReportFilters, { ReportFilterValues } from './ReportFilters'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function CashFlow() {
  const { user } = useAuth()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ReportFilterValues | null>(null)

  const loadData = useCallback(async (f: ReportFilterValues) => {
    if (!user) return
    setLoading(true)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .gte('date', f.dateRange.start)
      .lte('date', f.dateRange.end)
      .order('date', { ascending: true })

    const txs = Array.isArray(transactions) ? transactions : []

    // Agrupar por dia
    const dayMap: Record<string, { income: number; expense: number }> = {}
    txs.forEach((t: any) => {
      const day = t.date
      if (!dayMap[day]) dayMap[day] = { income: 0, expense: 0 }
      if (t.type === 'income') {
        dayMap[day].income += Number(t.amount || 0)
      } else if (t.type === 'expense' || t.type === 'sangria') {
        dayMap[day].expense += Number(t.amount || 0)
      }
    })

    const chartData = Object.entries(dayMap).map(([day, values]) => ({
      day: format(parseISO(day), 'dd/MM', { locale: ptBR }),
      Receitas: values.income,
      Despesas: values.expense,
      Saldo: values.income - values.expense,
    }))

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
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Fluxo de Caixa Diário</h3>
        {data.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Nenhum dado no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}