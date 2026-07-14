'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { Download, ListCollapse } from 'lucide-react'
import { BlobProvider } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { safeNumber, safeDate, safeFormatDate } from '@/lib/safe'

interface CashFlowProps {
  filters: ReportFilterValues
}

export default function CashFlow({ filters }: CashFlowProps) {
  const { user } = useAuth()
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { start, end } = filters.dateRange
  const { context, tags = [], accounts = [], creditCards = [] } = filters

  useEffect(() => {
    if (!user?.id || !start || !end) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        setLoading(true)

        let query = supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true })

        if (context === 'personal') query = query.eq('context', 'personal')
        if (tags.length > 0) query = query.overlaps('tag_ids', tags)
        if (accounts.length > 0) query = query.in('account_id', accounts)
        if (creditCards.length > 0) query = query.in('credit_card_id', creditCards)

        const { data, error } = await query
        if (error) console.error(error)
        setTransactions(data || [])
      } catch (error) {
        console.error('Erro ao carregar fluxo de caixa:', error)
        setTransactions([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id, start, end, context, tags.join(','), accounts.join(','), creditCards.join(',')])

  // Normaliza transações com data segura
  const normalizedTransactions = (Array.isArray(transactions) ? transactions : []).map((t) => {
    const parsedDate = safeDate(t?.date)
    return {
      ...t,
      amountValue: safeNumber(t?.amount),
      parsedDate,
      dateLabel: parsedDate ? parsedDate.toLocaleDateString('pt-BR') : 'Data inválida',
      dateKey: parsedDate ? parsedDate.toISOString().slice(0, 10) : 'invalid-date',
    }
  })

  // Agrupa por data (usando chave estável)
  const groupedByDate = normalizedTransactions.reduce((acc: any, t: any) => {
    const key = t.dateKey
    if (!acc[key]) {
      acc[key] = {
        key,
        date: t.dateLabel,
        transactions: [],
        totalIncome: 0,
        totalExpense: 0,
      }
    }

    acc[key].transactions.push(t)

    if (t.type === 'income') acc[key].totalIncome += t.amountValue
    else if (t.type === 'expense') acc[key].totalExpense += t.amountValue

    return acc
  }, {})

  // Ordena por data
  const groupedArray = Object.values(groupedByDate).sort((a: any, b: any) => a.key.localeCompare(b.key))

  const totalIncome = normalizedTransactions
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + t.amountValue, 0)

  const totalExpense = normalizedTransactions
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amountValue, 0)

  return (
    <div className="flex-1 animate-in fade-in duration-300">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groupedArray.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-3">
            <ListCollapse size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm font-medium">Nenhuma movimentação neste período.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-white dark:bg-slate-800 border border-gray-50 dark:border-slate-700/50 p-4 rounded-[24px] shadow-sm text-center">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Receitas</p>
              <p className="text-[18px] font-black text-emerald-600">
                + R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-gray-50 dark:border-slate-700/50 p-4 rounded-[24px] shadow-sm text-center">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Despesas</p>
              <p className="text-[18px] font-black text-red-500">
                - R$ {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {groupedArray.map((group: any) => (
              <div
                key={group.key}
                className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50 overflow-hidden"
              >
                <div className="flex justify-between items-center p-4 bg-gray-50/50 dark:bg-slate-700/20 border-b border-gray-100 dark:border-slate-700/50">
                  <h3 className="text-[13px] font-bold text-gray-800 dark:text-gray-200">{group.date}</h3>
                  <div className="flex space-x-3 text-[11px] font-bold">
                    <span className="text-emerald-600">
                      + R$ {group.totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-red-500">
                      - R$ {group.totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {group.transactions.map((t: any) => (
                    <div
                      key={t.id}
                      className="flex justify-between items-center p-4 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            t.type === 'income' ? 'bg-emerald-500' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                          }`}
                        />
                        <div>
                          <p className="font-bold text-gray-800 dark:text-gray-200 text-[13px]">{t.description}</p>
                          <p className="text-[11px] font-medium text-gray-400 mt-0.5">{t.categoryLabel || 'Geral'}</p>
                        </div>
                      </div>
                      <span className={`font-bold text-[14px] ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {t.type === 'income' ? '+' : '-'} R$ {t.amountValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {transactions.length > 0 && (
            <BlobProvider
              document={
                <ReportPDF
                  title="Fluxo de Caixa"
                  period={`${start} a ${end}`}
                  income={totalIncome}
                  expense={totalExpense}
                  balance={totalIncome - totalExpense}
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