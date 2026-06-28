'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Loader2 } from 'lucide-react'

const COLORS = ['#14b8a6', '#f97316']

export default function FixedVsVariable() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [data, setData] = useState<{ name: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ReportFilterValues>({
    context,
    dateRange: { start: '', end: '' },
    preset: 'thisMonth',
  })

  const loadData = useCallback(async (f: ReportFilterValues) => {
    if (!user || !f.dateRange.start || !f.dateRange.end) return
    setLoading(true)

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .in('type', ['expense', 'sangria'])
      .gte('date', f.dateRange.start)
      .lte('date', f.dateRange.end)

    const txs = Array.isArray(transactions) ? transactions : []

    let fixed = 0
    let variable = 0
    txs.forEach((tx: any) => {
      if (tx.is_fixed) {
        fixed += Number(tx.amount || 0)
      } else {
        variable += Number(tx.amount || 0)
      }
    })

    setData([
      { name: 'Fixos', value: fixed },
      { name: 'Variáveis', value: variable },
    ])
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadData(filters)
  }, [filters, loadData])

  return (
    <div className="space-y-4">
      <ReportFilters onChange={setFilters} initialPreset="thisMonth" />

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Distribuição de Gastos</h3>
        
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-teal-700" size={32} />
          </div>
        ) : data.reduce((acc, d) => acc + d.value, 0) === 0 ? (
          <p className="text-center text-gray-400 text-sm py-10">Nenhuma despesa neste período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
