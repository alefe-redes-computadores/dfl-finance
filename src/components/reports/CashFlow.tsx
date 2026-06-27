'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import { ReportFilterValues } from '@/components/reports/ReportFilters'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react'

export default function CashFlow() {
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

    // Agrupa por dia
    const dailyMap: Record<string, { income: number; expense: number }> = {}
    txs.forEach((tx: any) => {
      const day = tx.date
      if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 }
      if (tx.type === 'income') {
        dailyMap[day].income += Number(tx.amount || 0)
      } else if (tx.type === 'expense' || tx.type === 'sangria') {
        dailyMap[day].expense += Number(tx.amount || 0)
      }
    })

    const chartData = Object.entries(dailyMap).map(([date, values]) => ({
      date,
      ...values,
    }))

    setData(chartData)
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadData(filters)
  }, [filters, loadData])

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-teal-700" size={32} />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-50 dark:border-slate-700">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Fluxo de Caixa</h3>
      {data.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-10">Nenhuma transação no período.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="income" name="Receitas" fill="#14b8a6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Despesas" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}