// src/components/reports/ComparePeriods.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { BarChart2, Download, TrendingDown, TrendingUp } from 'lucide-react'
import { BlobProvider } from '@react-pdf/renderer'
import { differenceInCalendarDays, format, isValid, parseISO, subDays } from 'date-fns'
import { ReportFilterValues } from './ReportFilters'
import ReportPDF from '@/components/reports/ReportPDF'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useReportTransactions } from '@/hooks/useReportTransactions'
import { safeNumber } from '@/lib/safe'

interface ComparePeriodsProps {
  filters: ReportFilterValues
}

function isExpense(transaction: any) {
  return transaction?.type === 'expense' || transaction?.type === 'sangria'
}

function financialTransactions(transactions: any[]) {
  return transactions.filter((t) => t.type === 'income' || isExpense(t))
}

export default function ComparePeriods({ filters }: ComparePeriodsProps) {
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => setIsClient(true), [])

  const {
    dateRange: { start, end },
    context,
    tags = [],
    accounts = [],
    creditCards = [],
  } = filters

  const previousRange = useMemo(() => {
    if (!start || !end) return { start: null, end: null }

    const currentStart = parseISO(start)
    const currentEnd = parseISO(end)
    if (!isValid(currentStart) || !isValid(currentEnd) || currentEnd < currentStart) {
      return { start: null, end: null }
    }

    const diffDays = differenceInCalendarDays(currentEnd, currentStart)
    const previousEnd = subDays(currentStart, 1)
    const previousStart = subDays(previousEnd, diffDays)

    return {
      start: format(previousStart, 'yyyy-MM-dd'),
      end: format(previousEnd, 'yyyy-MM-dd'),
    }
  }, [start, end])

  const { data: currentRaw, loading: currentLoading } = useReportTransactions({
    context,
    startDate: start,
    endDate: end,
    tags,
    accounts,
    creditCards,
  })

  const { data: previousRaw, loading: previousLoading } = useReportTransactions({
    context,
    startDate: previousRange.start,
    endDate: previousRange.end,
    tags,
    accounts,
    creditCards,
  })

  const currentPeriod = useMemo(() => financialTransactions(currentRaw), [currentRaw])
  const previousPeriod = useMemo(() => financialTransactions(previousRaw), [previousRaw])

  const calcIncome = (items: any[]) =>
    items.filter((t) => t.type === 'income').reduce((sum, t) => sum + safeNumber(t.amount), 0)

  const calcExpense = (items: any[]) =>
    items.filter((t) => isExpense(t)).reduce((sum, t) => sum + safeNumber(t.amount), 0)

  const curInc = calcIncome(currentPeriod)
  const curExp = calcExpense(currentPeriod)
  const prevInc = calcIncome(previousPeriod)
  const prevExp = calcExpense(previousPeriod)

  const incDiff = curInc - prevInc
  const expDiff = curExp - prevExp
  const incPerc = prevInc > 0 ? (incDiff / prevInc) * 100 : 0
  const expPerc = prevExp > 0 ? (expDiff / prevExp) * 100 : 0

  const allTransactions = [...currentPeriod, ...previousPeriod]
  const loading = currentLoading || previousLoading

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
          <p className="text-gray-500 text-sm font-medium">Nenhum dado realizado para os períodos comparados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Receitas Atuais</p>
              <p className="text-[18px] font-black text-emerald-600">R$ {curInc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <div className={`mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${incDiff >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-red-50 dark:bg-red-500/10 text-red-500'}`}>
                {incDiff >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {incDiff >= 0 ? '+' : ''}{incPerc.toFixed(1)}% vs anterior
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-700/50">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Despesas Atuais</p>
              <p className="text-[18px] font-black text-red-500">R$ {curExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <div className={`mt-3 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${expDiff <= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-red-50 dark:bg-red-500/10 text-red-500'}`}>
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
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">R$ {prevInc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">Despesa anterior</span>
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">R$ {prevExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">Saldo anterior</span>
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">R$ {(prevInc - prevExp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
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

          {currentPeriod.length > 0 && (
            <BlobProvider document={
              <ReportPDF
                title="Comparar Períodos"
                period={`${start} a ${end}`}
                income={curInc}
                expense={curExp}
                balance={curInc - curExp}
                transactions={currentPeriod}
              />
            }>
              {({ url, loading: pdfLoading }: any) => (
                <button
                  type="button"
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
