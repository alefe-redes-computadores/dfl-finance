'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { PDFDownloadLink } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'

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

      // 🆕 Filtros cruzados (período atual)
      if (filters.tags && filters.tags.length > 0) {
        queryCurr = queryCurr.overlaps('tag_ids', filters.tags)
      }
      if (filters.accounts && filters.accounts.length > 0) {
        queryCurr = queryCurr.in('account_id', filters.accounts)
      }
      if (filters.creditCards && filters.creditCards.length > 0) {
        queryCurr = queryCurr.in('credit_card_id', filters.creditCards)
      }

      const { data: currData } = await queryCurr

      let queryPrev = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', prevStart.toISOString())
        .lte('date', prevEnd.toISOString())
      if (filters.context === 'personal') queryPrev = queryPrev.eq('context', 'personal')

      // 🆕 Filtros cruzados (período anterior)
      if (filters.tags && filters.tags.length > 0) {
        queryPrev = queryPrev.overlaps('tag_ids', filters.tags)
      }
      if (filters.accounts && filters.accounts.length > 0) {
        queryPrev = queryPrev.in('account_id', filters.accounts)
      }
      if (filters.creditCards && filters.creditCards.length > 0) {
        queryPrev = queryPrev.in('credit_card_id', filters.creditCards)
      }

      const { data: prevData } = await queryPrev

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

  const allTransactions = [...currentPeriod, ...previousPeriod]

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

          {/* Botão Exportar PDF */}
          {allTransactions.length > 0 && (
            <PDFDownloadLink
              document={
                <ReportPDF
                  title="Comparar Períodos"
                  period={`${filters.dateRange.start} a ${filters.dateRange.end}`}
                  income={curInc}
                  expense={curExp}
                  balance={curInc - curExp}
                  transactions={currentPeriod}
                />
              }
              fileName={`comparar-periodos-${Date.now()}.pdf`}
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