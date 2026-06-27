'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ReportFilters, { ReportFilterValues } from './ReportFilters'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { format, parseISO, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function WeekdayExpenses() {
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

    const txs = Array.isArray(transactions) ? transactions : []

    // Agrupar por dia da semana (apenas despesas)
    const dayMap: Record<number, number> = {}
    txs
      .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
      .forEach((t: any) => {
        const dayOfWeek = getDay(parseISO(t.date))
        dayMap[dayOfWeek] = (dayMap[dayOfWeek] || 0) + Number(t.amount || 0)
      })

    const chartData = WEEKDAYS.map((label, index) => ({
      name: label,
      Despesas: dayMap[index] || 0,
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

  // Encontrar o dia de maior gasto
  const maxDay = data.reduce((max, item) => (item.Despesas > max.Despesas ? item : max), data[0])

  return (
    <div>
      <ReportFilters onChange={setFilters} initialPreset={filters.preset} />

      {/* Destaque do dia de maior gasto */}
      {maxDay && maxDay.Despesas > 0 && (
        <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-1">Dia de maior gasto</p>
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold text-gray-800 dark:text-gray-200">{maxDay.name}</p>
            <p className="text-lg font-bold text-red-500">R$ {maxDay.Despesas.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Gráfico */}
      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Gastos por Dia da Semana</h3>
        {data.every(d => d.Despesas === 0) ? (
          <p className="text-center text-gray-400 text-sm py-10">Nenhum dado no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Despesas" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}