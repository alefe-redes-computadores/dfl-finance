'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'
import { FilterState } from '@/components/reports/ReportFilters'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Loader2, Download, FileText } from 'lucide-react'

interface Props {
  filters: FilterState
  onClose: () => void
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function WeekdayExpenses({ filters, onClose }: Props) {
  const { user } = useAuth()
  const { context } = useContext_()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const today = new Date()
    const start = format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd')
    const end = format(endOfMonth(today), 'yyyy-MM-dd')

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, type, date, status')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)

    const txArray = Array.isArray(txs) ? txs : []

    const weekdayTotals: number[] = Array(7).fill(0)
    const weekdayCounts: number[] = Array(7).fill(0)

    txArray
      .filter((tx: any) => (tx.type === 'expense' || tx.type === 'sangria') && tx.status === 'done')
      .forEach((tx: any) => {
        const dayIndex = new Date(tx.date + 'T12:00:00').getDay()
        weekdayTotals[dayIndex] += Number(tx.amount || 0)
        weekdayCounts[dayIndex] += 1
      })

    const result = WEEKDAYS_SHORT.map((name, i) => ({
      name,
      total: weekdayTotals[i],
      media: weekdayCounts[i] > 0 ? weekdayTotals[i] / weekdayCounts[i] : 0,
      transacoes: weekdayCounts[i],
    }))

    setData(result)
    setLoading(false)
  }, [user, context, filters])

  useEffect(() => { loadData() }, [loadData])

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const tableRows = data.map(d => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${d.name}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;color:#dc2626;">${formatCurrency(d.total)}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;">${formatCurrency(d.media)}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;">${d.transacoes}</td>
      </tr>
    `).join('')

    const html = `
      <html>
        <head>
          <title>Despesas por Dia da Semana - DFL Finance</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h2 { color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; color: #64748b; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h2>Despesas por Dia da Semana</h2>
          <table>
            <thead><tr><th>Dia</th><th style="text-align:right">Total Gasto</th><th style="text-align:right">Média</th><th style="text-align:right">Transações</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <p style="margin-top:20px;font-size:11px;color:#94a3b8;">DFL Finance • ${new Date().toLocaleDateString('pt-BR')}</p>
        </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.print()
  }

  const handleExportCSV = () => {
    const header = 'Dia,Total Gasto,Média por Transação,Quantidade\n'
    const rows = data.map(d => `"${d.name}",${d.total.toFixed(2)},${d.media.toFixed(2)},${d.transacoes}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `despesas-por-dia-semana.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Despesas por Dia da Semana</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(val: number) => formatCurrency(val)} />
            <Bar dataKey="total" fill="#f97316" name="Total Gasto" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Resumo por Dia</h3>
        <div className="space-y-2">
          {data.map(d => (
            <div key={d.name} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{d.name}</span>
              <div className="text-right">
                <p className="text-sm font-bold text-red-500">{formatCurrency(d.total)}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{d.transacoes} transações</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={handleExportPDF} className="flex-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl py-3 text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2">
          <FileText size={18} /> Exportar PDF
        </button>
        <button onClick={handleExportCSV} className="flex-1 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl py-3 text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2">
          <Download size={18} /> Exportar CSV
        </button>
      </div>
    </div>
  )
}