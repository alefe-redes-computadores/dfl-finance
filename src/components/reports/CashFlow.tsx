'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { Loader2, Download } from 'lucide-react'
import { BlobProvider } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'

interface CashFlowProps {
  filters: ReportFilterValues
}

export default function CashFlow({ filters }: CashFlowProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])

  useEffect(() => {
    if (!user?.id || !filters.dateRange.start || !filters.dateRange.end) return
    setLoading(true)

    const load = async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)
        .order('date', { ascending: true })

      if (filters.context === 'personal') {
        query = query.eq('context', 'personal')
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tag_ids', filters.tags)
      }
      if (filters.accounts && filters.accounts.length > 0) {
        query = query.in('account_id', filters.accounts)
      }
      if (filters.creditCards && filters.creditCards.length > 0) {
        query = query.in('credit_card_id', filters.creditCards)
      }

      const { data, error } = await query
      if (error) console.error(error)
      setTransactions(data || [])
      setLoading(false)
    }

    load()
  }, [user?.id, filters])

  const groupedByDate = transactions.reduce((acc: any, t: any) => {
    const date = new Date(t.date).toLocaleDateString('pt-BR')
    if (!acc[date]) acc[date] = { date, transactions: [], totalIncome: 0, totalExpense: 0 }
    acc[date].transactions.push(t)
    if (t.type === 'income') acc[date].totalIncome += t.amount
    else if (t.type === 'expense') acc[date].totalExpense += t.amount
    return acc
  }, {})

  const groupedArray = Object.values(groupedByDate)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : groupedArray.length === 0 ? (
        <div className="text-center p-8 text-slate-500">Nenhuma transação encontrada.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-emerald-50 dark:bg-emerald-950 p-4 rounded-xl">
              <p className="text-sm text-emerald-600 dark:text-emerald-400">Receitas</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">+ R$ {totalIncome.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">Despesas</p>
              <p className="text-xl font-bold text-red-700 dark:text-red-300">- R$ {totalExpense.toFixed(2)}</p>
            </div>
          </div>
          {groupedArray.map((group: any) => (
            <div key={group.date} className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-slate-500">{group.date}</h3>
                <div className="flex space-x-3 text-xs">
                  <span className="text-emerald-600">+ R$ {group.totalIncome.toFixed(2)}</span>
                  <span className="text-red-600">- R$ {group.totalExpense.toFixed(2)}</span>
                </div>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden">
                {group.transactions.map((t: any) => (
                  <div key={t.id} className="flex justify-between items-center p-3 border-b border-slate-200 dark:border-slate-700 last:border-0">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-3 ${t.type === 'income' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{t.description}</p>
                        <p className="text-xs text-slate-500">{t.category}</p>
                      </div>
                    </div>
                    <span className={`font-semibold text-sm ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Botão Exportar PDF */}
          {transactions.length > 0 && (
            <BlobProvider
              document={
                <ReportPDF
                  title="Fluxo de Caixa"
                  period={`${filters.dateRange.start} a ${filters.dateRange.end}`}
                  income={totalIncome}
                  expense={totalExpense}
                  balance={totalIncome - totalExpense}
                  transactions={transactions}
                />
              }
            >
              {({ url, loading: pdfLoading }: any) => (
                <button
                  onClick={() => url && window.open(url, '_blank')}
                  disabled={pdfLoading}
                  className="w-full mt-4 bg-teal-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={16} />
                  {pdfLoading ? 'Gerando PDF...' : 'Exportar PDF'}
                </button>
              )}
            </BlobProvider>
          )}
        </div>
      )}
    </div>
  )
}