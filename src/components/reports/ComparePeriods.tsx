'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import ReportFilters, { ReportFilterValues } from './ReportFilters'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { format, parseISO, differenceInDays, subDays } from 'date-fns'

export default function ComparePeriods() {
  const { user } = useAuth()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ReportFilterValues | null>(null)
  const [summary, setSummary] = useState({ current: 0, previous: 0, diff: 0, percent: 0 })

  const loadData = useCallback(async (f: ReportFilterValues) => {
    if (!user) return
    setLoading(true)

    const currentStart = f.dateRange.start
    const currentEnd = f.dateRange.end

    // Calcular período anterior com a mesma duração
    const duration = differenceInDays(parseISO(currentEnd), parseISO(currentStart))
    const previousEnd = format(subDays(parseISO(currentStart), 1), 'yyyy-MM-dd')
    const previousStart = format(subDays(parseISO(previousEnd), duration), 'yyyy-MM-dd')

    // Buscar transações do período atual
    const { data: currentTxs } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .gte('date', currentStart)
      .lte('date', currentEnd)

    // Buscar transações do período anterior
    const { data: previousTxs } = await supabase
      .from('transactions')
      .select('*, categories(name)')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .gte('date', previousStart)
      .lte('date', previousEnd)

    const curr = Array.isArray(currentTxs) ? currentTxs : []
    const prev = Array.isArray(previousTxs) ? previousTxs : []

    // Agrupar por categoria (despesas)
    const catMap: Record<string, { current: number; previous: number }> = {}
    
    curr
      .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
      .forEach((t: any) => {
        const name = t.categories?.name || 'Outros'
        if (!catMap[name]) catMap[name] = { current: 0, previous: 0 }
        catMap[name].current += Number(t.amount || 0)
      })

    prev
      .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
      .forEach((t: any) => {
        const name = t.categories?.name || 'Outros'
        if (!catMap[name]) catMap[name] = { current: 0, previous: 0 }
        catMap[name].previous += Number(t.amount || 0)
      })

    const chartData = Object.entries(catMap).map(([name, values]) => ({
      name,
      'Período Atual': values.current,
      'Período Anterior': values.previous,
    }))

    // Calcular totais
    const currentTotal = curr
      .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
      .reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0)
    const previousTotal = prev
      .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
      .reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0)
    
    const diff = currentTotal - previousTotal
    const percent = previousTotal > 0 ? ((diff / previousTotal) * 100) : 0

    setSummary({ current: currentTotal, previous: previousTotal, diff, percent })
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

      {/* Resumo comparativo */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-1">Período Atual</p>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-200">R$ {summary.current.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-1">Período Anterior</p>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-200">R$ {summary.previous.toFixed(2)}</p>
        </div>
      </div>

      {/* Variação */}
      <div className="mt-3 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700 flex items-center gap-3">
        {summary.diff > 0 ? (
          <TrendingUp size={24} className="text-red-500" />
        ) : (
          <TrendingDown size={24} className="text-emerald-500" />
        )}
        <div>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
            {summary.diff > 0 ? '+' : ''}R$ {summary.diff.toFixed(2)}
          </p>
          <p className={`text-xs font-bold ${summary.diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            {summary.percent > 0 ? '+' : ''}{summary.percent.toFixed(1)}% vs período anterior
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="mt-6 bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Comparação por Categoria</h3>
        {data.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Nenhum dado no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Período Atual" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Período Anterior" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}