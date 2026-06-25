'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'
import { FilterState } from '@/components/reports/ReportFilters'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Loader2, Download, FileText } from 'lucide-react'

interface Props {
  filters: FilterState
  onClose: () => void
}

export default function FixedVsVariable({ filters, onClose }: Props) {
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
    const start = format(startOfMonth(today), 'yyyy-MM-dd')
    const end = format(endOfMonth(today), 'yyyy-MM-dd')

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, type, recurring_group_id, status')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)

    const txArray = Array.isArray(txs) ? txs : []

    let fixedTotal = 0
    let variableTotal = 0

    txArray
      .filter((tx: any) => (tx.type === 'expense' || tx.type === 'sangria') && tx.status === 'done')
      .forEach((tx: any) => {
        if (tx.recurring_group_id || tx.total_installments > 1) {
          fixedTotal += Number(tx.amount || 0)
        } else {
          variableTotal += Number(tx.amount || 0)
        }
      })

    setData([
      { name: 'Gastos Fixos', value: fixedTotal, color: '#3b82f6' },
      { name: 'Gastos Variáveis', value: variableTotal, color: '#f97316' },
    ])
    setLoading(false)
  }, [user, context, filters])

  useEffect(() => { loadData() }, [loadData])

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const total = data.reduce((a, d) => a + d.value, 0)
    const tableRows = data.map(d => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${d.color};margin-right:8px;"></span>
          ${d.name}
        </td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;">${formatCurrency(d.value)}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;">${total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</td>
      </tr>
    `).join('')

    const html = `
      <html>
        <head>
          <title>Fixas x Variáveis - DFL Finance</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h2 { color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; color: #64748b; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h2>Fixas x Variáveis</h2>
          <table>
            <thead><tr><th>Tipo</th><th style="text-align:right">Valor</th><th style="text-align:right">%</th></tr></thead>
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
    const header = 'Tipo,Valor\n'
    const rows = data.map(d => `"${d.name}",${d.value.toFixed(2)}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fixas-x-variaveis.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  const total = data.reduce((a, d) => a + d.value, 0)

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Fixas x Variáveis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={4} stroke="none">
              {data.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(val: number) => formatCurrency(val)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Resumo</h3>
        <div className="space-y-2">
          {data.map(d => (
            <div key={d.name} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{d.name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{formatCurrency(d.value)}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</p>
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