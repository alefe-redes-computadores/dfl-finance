'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { Download } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'

const WEEKDAYS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
const COLORS = ['#6C5CE7','#00B894','#0984E3','#FDCB6E','#E17055','#E84393','#636E72']

interface WeekdayExpensesProps {
  filters: ReportFilterValues
}

export default function WeekdayExpenses({ filters }: WeekdayExpensesProps) {
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
        .eq('type', 'expense')
        .gte('date', filters.dateRange.start)
        .lte('date', filters.dateRange.end)

      if (filters.context === 'personal') query = query.eq('context', 'personal')

      // 🆕 Filtros cruzados
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

  const weekdayTotals = transactions.reduce((acc: any, t: any) => {
    const day = new Date(t.date).getDay()
    if (!acc[day]) acc[day] = { total: 0, count: 0 }
    acc[day].total += t.amount
    acc[day].count += 1
    return acc
  }, {})

  const data = WEEKDAYS.map((name, idx) => ({
    name,
    total: weekdayTotals[idx]?.total || 0,
    count: weekdayTotals[idx]?.count || 0,
  }))
  const max = Math.max(...data.map(d => d.total), 1)
  const totalExpense = transactions.reduce((a, t) => a + t.amount, 0)

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            {data.map((d, i) => (
              <div key={d.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{d.name}</span>
                  <span className="font-medium text-slate-800">R$ {d.total.toFixed(2)}{d.count > 0 && <span className="text-xs text-slate-500 ml-2">({d.count})</span>}</span>
                </div>
                <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.total / max) * 100}%`, backgroundColor: COLORS[i] }} />
                </div>
              </div>
            ))}
          </div>

          {/* Botão Exportar PDF */}
          {transactions.length > 0 && (
            <PDFDownloadLink
              document={
                <ReportPDF
                  title="Despesas por Dia da Semana"
                  period={`${filters.dateRange.start} a ${filters.dateRange.end}`}
                  income={0}
                  expense={totalExpense}
                  balance={-totalExpense}
                  transactions={transactions}
                />
              }
              fileName={`despesas-por-dia-semana-${Date.now()}.pdf`}
              className="w-full mt-4 bg-teal-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors flex items-center justify-center gap-2"
            >
              {({ loading: pdfLoading }: any) => (
                <>
                  <Download size={16} />
                  {pdfLoading ? 'Gerando PDF...' : 'Exportar PDF'}
                </>
              )}
            </PDFDownloadLink>
          )}
        </div>
      )}
    </div>
  )
}