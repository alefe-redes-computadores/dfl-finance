'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import { ReportFilterValues } from '@/components/reports/ReportFilters'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { Loader2, Download, Check, FileText } from 'lucide-react'

export default function ExportData() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [filters, setFilters] = useState<ReportFilterValues>({
    context,
    dateRange: { start: '', end: '' },
    preset: 'thisMonth',
  })

  const handleExportCSV = async () => {
    if (!user) return
    setLoading(true)
    setExportStatus('loading')

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', filters.dateRange.start)
      .lte('date', filters.dateRange.end)
      .order('date', { ascending: false })

    const txs = Array.isArray(transactions) ? transactions : []

    if (txs.length === 0) {
      alert('Nenhuma transação encontrada no período.')
      setLoading(false)
      setExportStatus('idle')
      return
    }

    const csvHeader = 'Data,Descrição,Tipo,Valor,Categoria,Conta,Status\n'
    const csvRows = txs.map((t: any) =>
      [
        t.date,
        `"${t.description || ''}"`,
        t.type,
        t.amount,
        t.category_id,
        t.account_id,
        t.status,
      ].join(',')
    )
    const csvContent = csvHeader + csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `transacoes-${filters.dateRange.start}-${filters.dateRange.end}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setLoading(false)
    setExportStatus('done')
    setTimeout(() => setExportStatus('idle'), 3000)
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-50 dark:border-slate-700">
      <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
        <FileText size={16} className="text-teal-600" />
        Exportar Dados
      </h3>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Exporte suas transações do período selecionado para CSV.
      </p>

      <button
        onClick={handleExportCSV}
        disabled={loading}
        className={`w-full py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 ${
          exportStatus === 'done'
            ? 'bg-emerald-500 text-white'
            : 'bg-teal-700 text-white hover:bg-teal-800'
        } disabled:opacity-50`}
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Exportando...
          </>
        ) : exportStatus === 'done' ? (
          <>
            <Check size={16} />
            Exportado!
          </>
        ) : (
          <>
            <Download size={16} />
            Exportar CSV
          </>
        )}
      </button>
    </div>
  )
}