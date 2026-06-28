'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ReportFilterValues } from './ReportFilters'

interface CashFlowProps {
  filters: ReportFilterValues
}

export default function CashFlow({ filters }: CashFlowProps) {
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
        .select('*')
        .eq('user_id', user.id)
        .eq('context', filters.context)   // sempre filtra por contexto
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: true })

      if (cancelled) return
      if (error) console.error('CashFlow error:', error)
      setTransactions(data || [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, filters.context, filters.dateRange.start, filters.dateRange.end])

  const groupedByDate = transactions.reduce((acc: any, t: any) => {
    // Usa parseISO para evitar bug de timezone ao formatar a data
    const dateKey = format(parseISO(t.date), "dd 'de' MMMM", { locale: ptBR })
    if (!acc[dateKey]) acc[dateKey] = { dateKey, transactions: [], totalIncome: 0, totalExpense: 0 }
    acc[dateKey].transactions.push(t)
    if (t.type === 'income') acc[dateKey].totalIncome += Number(t.amount)
    else if (t.type === 'expense') acc[dateKey].totalExpense += Number(t.amount)
    return acc
  }, {})

  const groupedArray = Object.values(groupedByDate) as any[]
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)
  const balance = totalIncome - totalExpense

  const fmt = (val: number) =>
    `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groupedArray.length === 0 ? (
        <div className="text-center p-8 text-slate-500 dark:text-slate-400">
          Nenhuma transação encontrada no período.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-xl">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Receitas</p>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                + {fmt(totalIncome)}
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/50 p-3 rounded-xl">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">Despesas</p>
              <p className="text-sm font-bold text-red-700 dark:text-red-300 mt-1">
                - {fmt(totalExpense)}
              </p>
            </div>
            <div className={`p-3 rounded-xl ${balance >= 0 ? 'bg-teal-50 dark:bg-teal-950/50' : 'bg-orange-50 dark:bg-orange-950/50'}`}>
              <p className={`text-xs font-medium ${balance >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-orange-600 dark:text-orange-400'}`}>
                Saldo
              </p>
              <p className={`text-sm font-bold mt-1 ${balance >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-orange-700 dark:text-orange-300'}`}>
                {balance >= 0 ? '+' : ''} {fmt(balance)}
              </p>
            </div>
          </div>

          {/* Lista por dia */}
          {groupedArray.map((group: any) => (
            <div key={group.dateKey} className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {group.dateKey}
                </h3>
                <div className="flex gap-3 text-xs">
                  {group.totalIncome > 0 && (
                    <span className="text-emerald-600 font-medium">+ {fmt(group.totalIncome)}</span>
                  )}
                  {group.totalExpense > 0 && (
                    <span className="text-red-600 font-medium">- {fmt(group.totalExpense)}</span>
                  )}
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-gray-50 dark:border-slate-700">
                {group.transactions.map((t: any, idx: number) => (
                  <div
                    key={t.id}
                    className={`flex justify-between items-center p-3 ${
                      idx < group.transactions.length - 1
                        ? 'border-b border-slate-100 dark:border-slate-700'
                        : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          t.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                          {t.description || '—'}
                        </p>
                        {t.category && (
                          <p className="text-xs text-slate-400 truncate">{t.category}</p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`font-semibold text-sm flex-shrink-0 ml-2 ${
                        t.type === 'income' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {t.type === 'income' ? '+' : '-'} {fmt(Number(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}