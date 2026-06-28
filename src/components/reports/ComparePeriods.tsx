'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'

interface ComparePeriodsProps {
  filters: ReportFilterValues
}

export default function ComparePeriods({ filters }: ComparePeriodsProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [currentPeriod, setCurrentPeriod] = useState<any[]>([])
  const [previousPeriod, setPreviousPeriod] = useState<any[]>([])

  useEffect(() => {
    if (!user?.id || !filters.dateRange.start || !filters.dateRange.end) return
    setLoading(true)

    const load = async () => {
      const currentStart = filters.dateRange.start
      const currentEnd = filters.dateRange.end

      // Período anterior de mesma duração
      const diff = new Date(currentEnd).getTime() - new Date(currentStart).getTime()
      const prevEnd = new Date(new Date(currentStart).getTime() - 86400000)
      const prevStart = new Date(prevEnd.getTime() - diff)

      let queryCurr = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', currentStart)
        .lte('date', currentEnd)
      if (filters.context === 'personal') queryCurr = queryCurr.eq('context', 'personal')
      const { data: currData, error: currErr } = await queryCurr
      if (currErr) console.error(currErr)

      let queryPrev = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', prevStart.toISOString())
        .lte('date', prevEnd.toISOString())
      if (filters.context === 'personal') queryPrev = queryPrev.eq('context', 'personal')
      const { data: prevData, error: prevErr } = await queryPrev
      if (prevErr) console.error(prevErr)

      setCurrentPeriod(currData || [])
      setPreviousPeriod(prevData || [])
      setLoading(false)
    }

    load()
  }, [user?.id, filters])

  const calc = (arr: any[], type: string) => arr.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0)
  const curInc = calc(currentPeriod, 'income')
  const curExp = calc(currentPeriod, 'expense')
  const prevInc = calc(previousPeriod, 'income')
  const prevExp = calc(previousPeriod, 'expense')

  const incDiff = curInc - prevInc
  const expDiff = curExp - prevExp
  const incPerc = prevInc ? (incDiff / prevInc) * 100 : 0
  const expPerc = prevExp ? (expDiff / prevExp) * 100 : 0

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
              <p className="text-xs text-slate-500 mb-2">Receitas (período atual)</p>
              <p className="text-lg font-bold text-emerald-600">R$ {curInc.toFixed(2)}</p>
              <div className="flex items-center mt-2 text-xs">
                {incDiff >= 0 ? <TrendingUp size={14} className="text-emerald-500 mr-1"/> : <TrendingDown size={14} className="text-red-500 mr-1"/>}
                <span className={incDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}>{incPerc.toFixed(1)}% vs anterior</span>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
              <p className="text-xs text-slate-500 mb-2">Despesas (período atual)</p>
              <p className="text-lg font-bold text-red-600">R$ {curExp.toFixed(2)}</p>
              <div className="flex items-center mt-2 text-xs">
                {expDiff <= 0 ? <TrendingDown size={14} className="text-emerald-500 mr-1"/> : <TrendingUp size={14} className="text-red-500 mr-1"/>}
                <span className={expDiff <= 0 ? 'text-emerald-600' : 'text-red-600'}>{expPerc.toFixed(1)}% vs anterior</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Resumo comparativo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Receita anterior</span><span>R$ {prevInc.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Despesa anterior</span><span>R$ {prevExp.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Saldo anterior</span><span>R$ {(prevInc - prevExp).toFixed(2)}</span></div>
              <hr className="dark:border-slate-700" />
              <div className="flex justify-between"><span className="text-slate-500">Saldo atual</span><span className={`font-bold ${curInc-curExp >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>R$ {(curInc-curExp).toFixed(2)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}