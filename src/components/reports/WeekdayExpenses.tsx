'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { parseISO } from 'date-fns'
import { ReportFilterValues } from './ReportFilters'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const COLORS = ['#6C5CE7', '#00B894', '#0984E3', '#FDCB6E', '#E17055', '#E84393', '#636E72']

interface WeekdayExpensesProps {
  filters: ReportFilterValues
}

export default function WeekdayExpenses({ filters }: WeekdayExpensesProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => {
    if (!user?.id || !filters.dateRange.start || !filters.dateRange.end) return

    let cancelled = false
    setLoading(true)

    const load = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, date, amount, type')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('context', filters.context)
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)

      if (cancelled) return
      if (error) console.error('WeekdayExpenses:', error)
      setTransactions(data || [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, filters.context, filters.dateRange.start, filters.dateRange.end])

  // Usa parseISO para evitar bug de timezone (new Date('2024-06-15') = dia 14 em UTC-3)
  const weekdayTotals = transactions.reduce((acc: any, t: any) => {
    const day = parseISO(t.date).getDay()
    if (!acc[day]) acc[day] = { total: 0, count: 0 }
    acc[day].total += Number(t.amount)
    acc[day].count += 1
    return acc
  }, {})

  const data = WEEKDAYS.map((name, idx) => ({
    name,
    total: weekdayTotals[idx]?.total || 0,
    count: weekdayTotals[idx]?.count || 0,
  }))

  const max = Math.max(...data.map(d => d.total), 1)
  const totalGeral = data.reduce((s, d) => s + d.total, 0)
  const maiorDia = data.reduce((prev, cur) => (cur.total > prev.total ? cur : prev), data[0])

  const fmt = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalGeral === 0 ? (
        <div className="text-center p-8 text-slate-500 dark:text-slate-400">
          Nenhuma despesa no período.
        </div>
      ) : (
        <div className="space-y-4">
          {maiorDia.total > 0 && (
            <div className="bg-teal-50 dark:bg-teal-900/30 rounded-xl p-3 border border-teal-100 dark:border-teal-900">
              <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                Dia com mais gastos
              </p>
              <p className="text-sm font-bold text-teal-700 dark:text-teal-300 mt-0.5">
                {maiorDia.name} — {fmt(maiorDia.total)}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {data.map((d, i) => (
              <div key={d.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">{d.name}</span>
                  <div className="flex items-center gap-2">
                    {d.count > 0 && (
                      <span className="text-xs text-slate-400">({d.count})</span>
                    )}
                    <span className={`font-semibold ${d.total > 0 ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400'}`}>
                      {fmt(d.total)}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(d.total / max) * 100}%`,
                      backgroundColor: COLORS[i],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}