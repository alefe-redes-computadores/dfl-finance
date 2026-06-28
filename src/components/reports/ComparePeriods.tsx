'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ReportFilterValues } from './ReportFilters'

interface ComparePeriodsProps {
  filters: ReportFilterValues
}

export default function ComparePeriods({ filters }: ComparePeriodsProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [currentPeriod, setCurrentPeriod] = useState<any[]>([])
  const [previousPeriod, setPreviousPeriod] = useState<any[]>([])
  const [prevRange, setPrevRange] = useState({ start: '', end: '' })

  useEffect(() => {
    if (!user?.id || !filters.dateRange.start || !filters.dateRange.end) return

    let cancelled = false
    setLoading(true)

    const load = async () => {
      const currentStart = filters.dateRange.start
      const currentEnd = filters.dateRange.end

      // Calcula período anterior de mesma duração
      const diffMs =
        new Date(currentEnd).getTime() - new Date(currentStart).getTime()
      const prevEndDate = new Date(new Date(currentStart).getTime() - 86400000)
      const prevStartDate = new Date(prevEndDate.getTime() - diffMs)

      const prevStartStr = format(prevStartDate, 'yyyy-MM-dd')
      const prevEndStr = format(prevEndDate, 'yyyy-MM-dd')
      setPrevRange({ start: prevStartStr, end: prevEndStr })

      const [currResult, prevResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('context', filters.context)
          .gte('date', currentStart)
          .lte('date', currentEnd),
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('context', filters.context)
          .gte('date', prevStartStr)
          .lte('date', prevEndStr),
      ])

      if (cancelled) return

      if (currResult.error) console.error('ComparePeriods curr:', currResult.error)
      if (prevResult.error) console.error('ComparePeriods prev:', prevResult.error)

      setCurrentPeriod(currResult.data || [])
      setPreviousPeriod(prevResult.data || [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, filters.context, filters.dateRange.start, filters.dateRange.end])

  const calc = (arr: any[], type: string) =>
    arr.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0)

  const curInc = calc(currentPeriod, 'income')
  const curExp = calc(currentPeriod, 'expense')
  const prevInc = calc(previousPeriod, 'income')
  const prevExp = calc(previousPeriod, 'expense')

  const incDiff = curInc - prevInc
  const expDiff = curExp - prevExp
  const incPerc = prevInc ? (incDiff / prevInc) * 100 : 0
  const expPerc = prevExp ? (expDiff / prevExp) * 100 : 0

  const fmt = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const fmtDate = (str: string) => {
    if (!str) return ''
    try { return format(parseISO(str), 'dd/MM/yy', { locale: ptBR }) } catch { return str }
  }

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Label dos períodos */}
          <div className="grid grid-cols-2 gap-2 text-xs text-center">
            <div className="bg-teal-50 dark:bg-teal-900/30 rounded-lg px-2 py-1.5 text-teal-700 dark:text-teal-400 font-medium">
              Atual: {fmtDate(filters.dateRange.start)} – {fmtDate(filters.dateRange.end)}
            </div>
            <div className="bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1.5 text-slate-500 dark:text-slate-400 font-medium">
              Anterior: {fmtDate(prevRange.start)} – {fmtDate(prevRange.end)}
            </div>
          </div>

          {/* Cards de receita e despesa */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Receitas</p>
              <p className="text-lg font-bold text-emerald-600">{fmt(curInc)}</p>
              <div className="flex items-center mt-2 text-xs gap-1">
                {incDiff >= 0
                  ? <TrendingUp size={14} className="text-emerald-500" />
                  : <TrendingDown size={14} className="text-red-500" />}
                <span className={incDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {incPerc >= 0 ? '+' : ''}{incPerc.toFixed(1)}% vs anterior
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Anterior: {fmt(prevInc)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Despesas</p>
              <p className="text-lg font-bold text-red-600">{fmt(curExp)}</p>
              <div className="flex items-center mt-2 text-xs gap-1">
                {expDiff <= 0
                  ? <TrendingDown size={14} className="text-emerald-500" />
                  : <TrendingUp size={14} className="text-red-500" />}
                <span className={expDiff <= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {expPerc >= 0 ? '+' : ''}{expPerc.toFixed(1)}% vs anterior
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">Anterior: {fmt(prevExp)}</p>
            </div>
          </div>

          {/* Resumo comparativo */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">
              Resumo comparativo
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Receita anterior</span>
                <span>{fmt(prevInc)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Despesa anterior</span>
                <span>{fmt(prevExp)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Saldo anterior</span>
                <span className={prevInc - prevExp >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {fmt(prevInc - prevExp)}
                </span>
              </div>
              <hr className="border-slate-200 dark:border-slate-700" />
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Receita atual</span>
                <span className="text-emerald-600 font-medium">{fmt(curInc)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Despesa atual</span>
                <span className="text-red-600 font-medium">{fmt(curExp)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-700 dark:text-slate-200">Saldo atual</span>
                <span className={curInc - curExp >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {fmt(curInc - curExp)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}