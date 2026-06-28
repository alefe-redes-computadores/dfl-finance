'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters'
import { format, parseISO, subMonths } from 'date-fns'
import { Loader2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'

export default function ComparePeriods() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [currentTotal, setCurrentTotal] = useState(0)
  const [previousTotal, setPreviousTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<ReportFilterValues>({
    context,
    dateRange: { start: '', end: '' },
    preset: 'thisMonth',
  })

  const loadData = useCallback(async (f: ReportFilterValues) => {
    if (!user || !f.dateRange.start || !f.dateRange.end) return
    setLoading(true)

    const { data: currentTx } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .in('type', ['expense', 'sangria'])
      .gte('date', f.dateRange.start)
      .lte('date', f.dateRange.end)

    const currentSum = (Array.isArray(currentTx) ? currentTx : []).reduce(
      (sum, t) => sum + Number(t.amount || 0), 0
    )
    setCurrentTotal(currentSum)

    const start = parseISO(f.dateRange.start)
    const end = parseISO(f.dateRange.end)
    const prevStart = format(subMonths(start, 1), 'yyyy-MM-dd')
    const prevEnd = format(subMonths(end, 1), 'yyyy-MM-dd')

    const { data: prevTx } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user.id)
      .eq('context', f.context)
      .in('type', ['expense', 'sangria'])
      .gte('date', prevStart)
      .lte('date', prevEnd)

    const prevSum = (Array.isArray(prevTx) ? prevTx : []).reduce(
      (sum, t) => sum + Number(t.amount || 0), 0
    )
    setPreviousTotal(prevSum)
    setLoading(false)
  }, [user])

  useEffect(() => {
    loadData(filters)
  }, [filters, loadData])

  const difference = currentTotal - previousTotal
  const percent = previousTotal > 0 ? ((difference / previousTotal) * 100) : 0

  return (
    <div className="space-y-4">
      <ReportFilters onChange={setFilters} initialPreset="thisMonth" />
      
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Evolução Mensal</h3>
        
        {loading ? (
           <div className="flex justify-center py-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Atual</p><p className="text-lg font-bold text-gray-800 dark:text-gray-200">R$ {currentTotal.toFixed(2)}</p></div>
              <ArrowRight size={20} className="text-gray-400" />
              <div><p className="text-xs text-gray-500">Anterior</p><p className="text-lg font-bold text-gray-800 dark:text-gray-200">R$ {previousTotal.toFixed(2)}</p></div>
            </div>
            <div className={`flex items-center gap-2 ${difference < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {difference < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
              <span className="text-sm font-bold">{difference < 0 ? '-' : '+'} R$ {Math.abs(difference).toFixed(2)} ({percent.toFixed(1)}%)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
