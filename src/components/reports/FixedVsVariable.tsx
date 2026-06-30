'use client'

import React, { useState, useEffect } from 'react'
import { Lock, Repeat, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { PDFDownloadLink } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'

const FIXED_CATEGORIES = ['Moradia','Assinaturas','Educação','Saúde','Financiamento']

interface FixedVsVariableProps {
  filters: ReportFilterValues
}

export default function FixedVsVariable({ filters }: FixedVsVariableProps) {
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
        .order('date', { ascending: false })

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

  const fixed = transactions.filter(t => t.is_fixed !== undefined ? t.is_fixed : FIXED_CATEGORIES.includes(t.category))
  const variable = transactions.filter(t => t.is_fixed !== undefined ? !t.is_fixed : !FIXED_CATEGORIES.includes(t.category))
  const totalFixed = fixed.reduce((s,t) => s + t.amount, 0)
  const totalVar = variable.reduce((s,t) => s + t.amount, 0)
  const total = totalFixed + totalVar
  const fixedPerc = total ? (totalFixed / total) * 100 : 0
  const varPerc = total ? (totalVar / total) * 100 : 0

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-xl">
              <div className="flex items-center mb-2"><Lock size={16} className="text-amber-600 mr-1" /><p className="text-sm text-amber-600">Fixas</p></div>
              <p className="text-xl font-bold text-amber-700">R$ {totalFixed.toFixed(2)}</p>
              <p className="text-xs text-amber-600 mt-1">{fixedPerc.toFixed(1)}% do total</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-xl">
              <div className="flex items-center mb-2"><Repeat size={16} className="text-blue-600 mr-1" /><p className="text-sm text-blue-600">Variáveis</p></div>
              <p className="text-xl font-bold text-blue-700">R$ {totalVar.toFixed(2)}</p>
              <p className="text-xs text-blue-600 mt-1">{varPerc.toFixed(1)}% do total</p>
            </div>
          </div>
          <div className="bg-slate-200 dark:bg-slate-700 rounded-full h-4 overflow-hidden">
            <div className="h-full bg-amber-500 rounded-l-full" style={{ width: `${fixedPerc}%` }} />
          </div>
          {fixed.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Despesas Fixas ({fixed.length})</h3>
              {fixed.slice(0,5).map(t => (
                <div key={t.id} className="flex justify-between text-sm text-slate-600">
                  <span>{t.description}</span>
                  <span className="font-medium">R$ {t.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
          {variable.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Despesas Variáveis ({variable.length})</h3>
              {variable.slice(0,5).map(t => (
                <div key={t.id} className="flex justify-between text-sm text-slate-600">
                  <span>{t.description}</span>
                  <span className="font-medium">R$ {t.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Botão Exportar PDF */}
          {transactions.length > 0 && (
            <PDFDownloadLink
              document={
                <ReportPDF
                  title="Despesas Fixas vs Variáveis"
                  period={`${filters.dateRange.start} a ${filters.dateRange.end}`}
                  income={0}
                  expense={total}
                  balance={-total}
                  transactions={transactions}
                />
              }
              fileName={`fixas-vs-variaveis-${Date.now()}.pdf`}
              className="w-full mt-4 bg-teal-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors flex items-center justify-center gap-2"
            >
              {({ loading: pdfLoading }: { loading: boolean }) => (
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