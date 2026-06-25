'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'
import { FilterState } from '@/components/reports/ReportFilters'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { Loader2, Download, Check, FileText } from 'lucide-react'

interface Props {
  filters: FilterState
  onClose: () => void
}

export default function ExportData({ filters, onClose }: Props) {
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(false)
  const [exported, setExported] = useState(false)

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const handleExportCSV = async () => {
    if (!user?.id) return
    setLoading(true)

    const today = new Date()
    const start = format(startOfMonth(subMonths(today, 11)), 'yyyy-MM-dd')
    const end = format(endOfMonth(today), 'yyyy-MM-dd')

    const { data: txs } = await supabase
      .from('transactions')
      .select('date, description, amount, type, status, categories(name)')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    const txArray = Array.isArray(txs) ? txs : []

    const header = 'Data,Descrição,Categoria,Tipo,Valor,Status\n'
    const rows = txArray.map((tx: any) => {
      const tipo = tx.type === 'income' ? 'Receita' : 'Despesa'
      const status = tx.status === 'done' ? 'Pago' : 'Pendente'
      return `"${tx.date}","${tx.description || ''}","${tx.categories?.name || 'Geral'}","${tipo}",${Number(tx.amount || 0).toFixed(2)},"${status}"`
    }).join('\n')

    const csv = header + rows
    const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extrato-dfl-${start}-a-${end}.csv`
    a.click()

    setExported(true)
    setTimeout(() => setExported(false), 2000)
    setLoading(false)
  }

  const handleExportPDF = async () => {
    if (!user?.id) return
    setLoading(true)

    const today = new Date()
    const start = format(startOfMonth(subMonths(today, 11)), 'yyyy-MM-dd')
    const end = format(endOfMonth(today), 'yyyy-MM-dd')

    const { data: txs } = await supabase
      .from('transactions')
      .select('date, description, amount, type, status, categories(name)')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    const txArray = Array.isArray(txs) ? txs : []

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setLoading(false)
      return
    }

    const tableRows = txArray.map((tx: any) => {
      const isIncome = tx.type === 'income'
      const color = isIncome ? '#059669' : '#dc2626'
      const prefix = isIncome ? '+' : '-'
      const tipo = isIncome ? 'Receita' : 'Despesa'
      const status = tx.status === 'done' ? 'Pago' : 'Pendente'
      const statusColor = tx.status === 'done' ? '#059669' : '#f59e0b'

      return `
        <tr>
          <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:11px;">${tx.date}</td>
          <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:11px;">${tx.description || '—'}</td>
          <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:11px;">${tx.categories?.name || 'Geral'}</td>
          <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:11px;">${tipo}</td>
          <td style="padding:6px;text-align:right;border-bottom:1px solid #e5e7eb;font-size:11px;color:${color};">${prefix} ${formatCurrency(Number(tx.amount || 0))}</td>
          <td style="padding:6px;border-bottom:1px solid #e5e7eb;font-size:11px;color:${statusColor};">${status}</td>
        </tr>
      `
    }).join('')

    const html = `
      <html>
        <head>
          <title>Extrato DFL Finance</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h2 { color: #0f172a; margin-bottom: 4px; }
            .period { font-size: 12px; color: #64748b; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th { padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 10px; text-transform: uppercase; color: #64748b; background: #f8fafc; }
            .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <h2>Extrato de Transações</h2>
          <p class="period">Período: ${start} até ${end}</p>
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th style="text-align:right">Valor</th><th>Status</th></tr></thead>
            <tbody>${tableRows || '<tr><td colspan="6" style="text-align:center;padding:16px;">Nenhuma transação no período.</td></tr>'}</tbody>
          </table>
          <p class="footer">DFL Finance • ${new Date().toLocaleDateString('pt-BR')} • ${txArray.length} transações</p>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.print()
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-20 h-20 bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <Download size={40} className="text-teal-700 dark:text-teal-400" />
        </div>
        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Exportar Dados</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Baixe todas as suas transações dos últimos 12 meses em um arquivo.
        </p>
        <div className="space-y-3">
          <button
            onClick={handleExportCSV}
            disabled={loading}
            className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : exported ? (
              <>
                <Check size={20} /> Exportado!
              </>
            ) : (
              <>
                <Download size={20} /> Baixar CSV completo
              </>
            )}
          </button>
          <button
            onClick={handleExportPDF}
            disabled={loading}
            className="w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
          >
            <FileText size={20} /> Baixar PDF completo
          </button>
        </div>
      </div>
    </div>
  )
}