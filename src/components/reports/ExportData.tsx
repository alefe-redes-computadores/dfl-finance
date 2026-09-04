// src/components/reports/ExportData.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, FileJson, FileText } from 'lucide-react'
import { ReportFilterValues } from './ReportFilters'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useReportTransactions } from '@/hooks/useReportTransactions'
import { safeNumber } from '@/lib/safe'

interface ExportDataProps {
  filters: ReportFilterValues
}

function isExpense(transaction: any) {
  return transaction?.type === 'expense' || transaction?.type === 'sangria'
}

function formatLocalDate(value: unknown) {
  if (typeof value !== 'string') return ''

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value

  return `${match[3]}/${match[2]}/${match[1]}`
}

function localTodayISO() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function csvCell(value: unknown) {
  const normalized = String(value ?? '').replace(/"/g, '""')
  return `"${normalized}"`
}

function typeLabel(type: unknown) {
  if (type === 'income') return 'Receita'
  if (type === 'sangria') return 'Sangria'
  if (type === 'expense') return 'Despesa'
  if (type === 'transfer') return 'Transferência'
  return String(type || '')
}

export default function ExportData({ filters }: ExportDataProps) {
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { context, dateRange } = filters
  const { start = '', end = '' } = dateRange
  const { tags = [], accounts = [], creditCards = [] } = filters

  const {
    data: transactions,
    loading,
  } = useReportTransactions({
    context,
    startDate: start,
    endDate: end,
    tags,
    accounts,
    creditCards,
  })

  const realizedTransactions = useMemo(
    () =>
      (transactions || []).map((transaction: any) => ({
        ...transaction,
        amountValue: safeNumber(transaction.amount),
        categoryLabel: transaction.categoryLabel || 'Geral',
      })),
    [transactions]
  )

  const incomeTotal = useMemo(
    () =>
      realizedTransactions
        .filter((transaction: any) => transaction.type === 'income')
        .reduce(
          (sum: number, transaction: any) =>
            sum + transaction.amountValue,
          0
        ),
    [realizedTransactions]
  )

  const expenseTotal = useMemo(
    () =>
      realizedTransactions
        .filter((transaction: any) => isExpense(transaction))
        .reduce(
          (sum: number, transaction: any) =>
            sum + transaction.amountValue,
          0
        ),
    [realizedTransactions]
  )

  const downloadBlob = (
    content: BlobPart,
    type: string,
    filename: string
  ) => {
    const blob = new Blob([content], { type })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(() => {
      window.URL.revokeObjectURL(url)
    }, 300)
  }

  const exportCSV = () => {
    if (!realizedTransactions.length || !isClient || exporting) return

    vibrate([10])
    setExporting(true)

    try {
      const headers = [
        'Data',
        'Descrição',
        'Categoria',
        'Tipo',
        'Valor (R$)',
        'Status',
        'Contexto',
      ]

      const rows = realizedTransactions.map((transaction: any) => [
        csvCell(formatLocalDate(transaction.date)),
        csvCell(transaction.description || ''),
        csvCell(transaction.categoryLabel || 'Geral'),
        csvCell(typeLabel(transaction.type)),
        csvCell(
          transaction.amountValue.toFixed(2).replace('.', ',')
        ),
        csvCell('Realizada'),
        csvCell(
          transaction.context === 'personal' ? 'Pessoal' : 'DFL'
        ),
      ])

      const csv =
        '\uFEFF' +
        [
          headers.map(csvCell).join(';'),
          ...rows.map((row) => row.join(';')),
        ].join('\n')

      downloadBlob(
        csv,
        'text/csv;charset=utf-8;',
        `dfl-export-${localTodayISO()}.csv`
      )

      success()
    } catch (error) {
      console.error('Erro ao exportar CSV:', error)
    } finally {
      setExporting(false)
    }
  }

  const exportJSON = () => {
    if (!realizedTransactions.length || !isClient || exporting) return

    vibrate([10])
    setExporting(true)

    try {
      const enriched = realizedTransactions.map(
        (transaction: any) => ({
          ...transaction,
          category_name: transaction.categoryLabel || 'Geral',
          amount_number: transaction.amountValue,
        })
      )

      downloadBlob(
        JSON.stringify(enriched, null, 2),
        'application/json;charset=utf-8;',
        `dfl-export-${localTodayISO()}.json`
      )

      success()
    } catch (error) {
      console.error('Erro ao exportar JSON:', error)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex-1 animate-in fade-in duration-300">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-[28px] p-8 shadow-sm border border-gray-50 dark:border-slate-700/50 flex flex-col items-center">
            <div className="w-16 h-16 bg-teal-50 dark:bg-teal-500/10 rounded-[20px] flex items-center justify-center mb-4 text-teal-600">
              <Download size={32} />
            </div>

            <p className="text-[40px] font-light text-gray-800 dark:text-gray-100 tracking-tight leading-none mb-1">
              {realizedTransactions.length}
            </p>

            <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">
              Transações Realizadas
            </p>

            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-[16px] text-center border border-emerald-100 dark:border-emerald-500/20">
                <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest mb-1">
                  Receitas
                </p>
                <p className="font-bold text-[14px] text-emerald-600">
                  R$ {incomeTotal.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>

              <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-[16px] text-center border border-red-100 dark:border-red-500/20">
                <p className="text-[10px] font-bold text-red-600/70 uppercase tracking-widest mb-1">
                  Despesas
                </p>
                <p className="font-bold text-[14px] text-red-500">
                  R$ {expenseTotal.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>
          </div>

          {realizedTransactions.length === 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 border border-gray-50 dark:border-slate-700/50 text-center">
              <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                Nada para exportar
              </p>
              <p className="text-xs font-medium text-gray-400 mt-1">
                Nenhuma transação realizada corresponde aos filtros selecionados.
              </p>
            </div>
          )}

          <div className="grid gap-3">
            <button
              type="button"
              onClick={exportCSV}
              disabled={exporting || !realizedTransactions.length}
              className="w-full flex items-center justify-center gap-3 p-4 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white rounded-[24px] font-bold text-[15px] transition-all active:scale-[0.98] shadow-lg shadow-teal-600/30 disabled:shadow-none"
            >
              <FileText size={20} />
              Exportar para Excel (CSV)
            </button>

            <button
              type="button"
              onClick={exportJSON}
              disabled={exporting || !realizedTransactions.length}
              className="w-full flex items-center justify-center gap-3 p-4 bg-slate-800 hover:bg-slate-900 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white rounded-[24px] font-bold text-[15px] transition-all active:scale-[0.98] shadow-lg shadow-slate-800/30 disabled:shadow-none"
            >
              <FileJson size={20} />
              Exportar Raw (JSON)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
