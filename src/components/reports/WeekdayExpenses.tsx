'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { Download, CalendarDays } from 'lucide-react'
import { BlobProvider } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { safeNumber, safeDate, safeFormatDate } from '@/lib/safe'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const COLORS = ['#6C5CE7', '#00B894', '#0984E3', '#FDCB6E', '#E17055', '#E84393', '#636E72']

interface TransactionItem {
  id: string
  date: string
  amount: number | string
  description?: string | null
  type: string
  account_id?: string | null
  credit_card_id?: string | null
  tag_ids?: string[] | null
  context?: string | null
  categories?: { name?: string | null } | null
}

interface WeekdayExpensesProps {
  filters: ReportFilterValues
}

export default function WeekdayExpenses({ filters }: WeekdayExpensesProps) {
  const { user } = useAuth()
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<TransactionItem[]>([])

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { start, end } = filters.dateRange
  const { context, tags = [], accounts = [], creditCards = [] } = filters

  // 🔥 SUBSTITUÍDO: useEffect com dependências quebradas e query com join
  useEffect(() => {
    if (!user?.id || !start || !end) {
      setTransactions([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const load = async () => {
      let query = supabase
        .from('transactions')
        .select(`
          id,
          date,
          amount,
          description,
          type,
          account_id,
          credit_card_id,
          tag_ids,
          context,
          categories(name)
        `)
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', start)
        .lte('date', end)

      if (context) query = query.eq('context', context)
      if (tags?.length) query = query.overlaps('tag_ids', tags)
      if (accounts?.length) query = query.in('account_id', accounts)
      if (creditCards?.length) query = query.in('credit_card_id', creditCards)

      const { data, error } = await query

      if (cancelled) return

      if (error) {
        console.error('WeekdayExpenses:', error)
        setTransactions([])
      } else {
        setTransactions((data as TransactionItem[]) || [])
      }

      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user?.id, context, start, end, tags, accounts, creditCards])

  // 🔥 SUBSTITUÍDO: cálculo com validação de data
  const weekdayTotals = transactions.reduce<Record<number, { total: number; count: number }>>((acc, t) => {
    if (!t.date) return acc

    const parsedDate = new Date(`${t.date}T12:00:00`)
    if (Number.isNaN(parsedDate.getTime())) return acc

    const day = parsedDate.getDay()
    if (!acc[day]) acc[day] = { total: 0, count: 0 }

    acc[day].total += Number(t.amount) || 0
    acc[day].count += 1
    return acc
  }, {})

  const data = WEEKDAYS.map((name, idx) => ({
    name,
    total: weekdayTotals[idx]?.total || 0,
    count: weekdayTotals[idx]?.count || 0,
  }))

  const max = Math.max(...data.map((d) => d.total), 1)

  // 🔥 SUBSTITUÍDO: total com Number
  const totalExpense = transactions.reduce((a, t) => a + (Number(t.amount) || 0), 0)

  return (
    <div className="flex-1 animate-in fade-in duration-300">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-[18px] flex items-center justify-center mb-3">
            <CalendarDays size={24} className="text-gray-400" />
          </div>
          <p className="font-bold text-gray-800 dark:text-gray-200 mb-1">Sem despesas na semana</p>
          <p className="text-sm font-medium text-gray-400">Nenhum registro encontrado para este período.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <h3 className="font-bold text-[14px] text-gray-800 dark:text-gray-200 mb-5">Gastos por Dia</h3>
            <div className="space-y-4">
              {data.map((d, i) => (
                <div key={d.name} className="space-y-1.5">
                  <div className="flex justify-between items-end">
                    <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {d.name}
                    </span>
                    <span className="font-black text-[14px] text-gray-800 dark:text-gray-200">
                      R$ {d.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      {d.count > 0 && (
                        <span className="text-[11px] font-bold text-gray-400 ml-1">({d.count})</span>
                      )}
                    </span>
                  </div>
                  <div className="bg-gray-100 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden shadow-inner">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
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

          {transactions.length > 0 && (
            <BlobProvider
              document={
                <ReportPDF
                  title="Despesas por Dia da Semana"
                  period={`${start} a ${end}`}
                  income={0}
                  expense={totalExpense}
                  balance={-totalExpense}
                  transactions={transactions}
                />
              }
            >
              {({ url, loading: pdfLoading }: any) => (
                <button
                  onClick={() => {
                    vibrate([10])
                    if (url && isClient) {
                      success()
                      window.open(url, '_blank', 'noopener,noreferrer')
                    }
                  }}
                  disabled={pdfLoading}
                  className="w-full mt-2 bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[20px] font-bold text-[14px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 disabled:opacity-50 active:scale-[0.98]"
                >
                  <Download size={18} />
                  {pdfLoading ? 'Gerando PDF...' : 'Exportar Relatório Completo'}
                </button>
              )}
            </BlobProvider>
          )}
        </div>
      )}
    </div>
  )
}