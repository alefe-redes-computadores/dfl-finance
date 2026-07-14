'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Download, BarChart2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'
import { BlobProvider } from '@react-pdf/renderer'
import ReportPDF from '@/components/reports/ReportPDF'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { safeNumber, safeDate, safeFormatDate } from '@/lib/safe'
import { subDays, differenceInDays } from 'date-fns'

interface ComparePeriodsProps {
  filters: ReportFilterValues
}

export default function ComparePeriods({ filters }: ComparePeriodsProps) {
  const { user } = useAuth()
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentPeriod, setCurrentPeriod] = useState<any[]>([])
  const [previousPeriod, setPreviousPeriod] = useState<any[]>([])

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Cálculo seguro
  const calc = (arr: any[], type: string) =>
    (Array.isArray(arr) ? arr : [])
      .filter((t) => t?.type === type)
      .reduce((sum, t) => sum + safeNumber(t?.amount), 0)

  // Dependências quebradas
  const {
    dateRange: { start, end },
    context,
    tags = [],
    accounts = [],
    creditCards = [],
  } = filters

  useEffect(() => {
    if (!user?.id || !start || !end) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        setLoading(true)

        const currentStart = start
        const currentEnd = end

        // Calcula período anterior com diferença exata (mesmo número de dias)
        const diffDays = differenceInDays(new Date(currentEnd), new Date(currentStart))
        const prevEnd = subDays(new Date(currentStart), 1)
        const prevStart = subDays(prevEnd, diffDays)

        const prevStartStr = prevStart.toISOString().split('T')[0]
        const prevEndStr = prevEnd.toISOString().split('T')[0]

        // Query atual
        let queryCurr = supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', currentStart)
          .lte('date', currentEnd)

        if (context === 'personal') queryCurr = queryCurr.eq('context', 'personal')
        if (tags.length > 0) queryCurr = queryCurr.overlaps('tag_ids', tags)
        if (accounts.length > 0) queryCurr = queryCurr.in('account_id', accounts)
        if (creditCards.length > 0) queryCurr = queryCurr.in('credit_card_id', creditCards)

        const { data: currData } = await queryCurr

        // Query anterior
        let queryPrev = supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', prevStartStr)
          .lte('date', prevEndStr)

        if (context === 'personal') queryPrev = queryPrev.eq('context', 'personal')
        if (tags.length > 0) queryPrev = queryPrev.overlaps('tag_ids', tags)
        if (accounts.length > 0) queryPrev = queryPrev.in('account_id', accounts)
        if (creditCards.length > 0) queryPrev = queryPrev.in('credit_card_id', creditCards)

        const { data: prevData } = await queryPrev

        setCurrentPeriod(currData || [])
        setPreviousPeriod(prevData || [])
      } catch (error) {
        console.error('Erro ao carregar comparação:', error)
        setCurrentPeriod([])
        setPreviousPeriod([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user?.id, start, end, context, tags.join(','), accounts.join(','), creditCards.join(',')])

  const curInc = calc(currentPeriod, 'income')
  const curExp = calc(currentPeriod, 'expense')
  const prevInc = calc(previousPeriod, 'income')
  const prevExp = calc(previousPeriod, 'expense')

  const incDiff = curInc - prevInc
  const expDiff = curExp - prevExp
  const incPerc = prevInc > 0 ? (incDiff / prevInc) * 100 : 0
  const expPerc = prevExp > 0 ? (expDiff / prevExp) * 100 : 0

  const allTransactions = [...currentPeriod, ...previousPeriod]

  return (
    <div className="flex-1 animate-in fade-in duration-300">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : allTransactions.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 text-center py-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-[18px] flex items-center justify-center mb-3">
            <BarChart2 size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm font-medium">Nenhum dado para os períodos comparados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Receitas Atuais</p>
              <p className="text-[18px] font-black text-emerald-600">
                R$ {curInc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <div className={`mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                incDiff >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-red-50 dark:bg-red-500/10 text-red-500'
              }`}>
                {incDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {incDiff >= 0 ? '+' : ''}{incPerc.toFixed(1)}% vs anterior
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Despesas Atuais</p>
              <p className="text-[18px] font-black text-red-500">
                R$ {curExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <div className={`mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${
                expDiff <= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-red-50 dark:bg-red-500/10 text-red-500'
              }`}>
                {expDiff <= 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                {expDiff > 0 ? '+' : ''}{expPerc.toFixed(1)}% vs anterior
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700/50">
            <h3 className="font-bold text-[14px] text-gray-800 dark:text-gray-200 mb-4">Resumo Comparativo</h3>
            <div className="space-y-3 bg-gray-50 dark:bg-slate-700/30 p-4 rounded-[16px]">
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">Receita anterior</span>
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                  R$ {prevInc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">Despesa anterior</span>
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                  R$ {prevExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">Saldo anterior</span>
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                  R$ {(prevInc - prevExp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="h-px bg-gray-200 dark:bg-slate-600 my-2" />
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">Saldo atual</span>
                <span className={`text-[15px] font-black ${curInc - curExp >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  R$ {(curInc - curExp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {allTransactions.length > 0 && (
            <BlobProvider
              document={
                <ReportPDF
                  title="Comparar Períodos"
                  period={`${start} a ${end}`}
                  income={curInc}
                  expense={curExp}
                  balance={curInc - curExp}
                  transactions={currentPeriod}
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