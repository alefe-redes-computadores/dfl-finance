'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'
import { FilterState } from '@/components/reports/ReportFilters'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Loader2, Download, FileText } from 'lucide-react'

interface Props {
  filters: FilterState
  onClose: () => void
}

export default function CashFlow({ filters, onClose }: Props) {
  const { user } = useAuth()
  const { context } = useContext_()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    // Últimos 6 meses
    const today = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(today, i)
      months.push(format(d, 'yyyy-MM'))
    }

    const start = format(startOfMonth(subMonths(today, 5)), 'yyyy-MM-dd')
    const end = format(endOfMonth(today), 'yyyy-MM-dd')

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, type, date, status')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)

    const txArray = Array.isArray(txs) ? txs : []

    const monthlyData = months.map(month => {
      const monthTxs = txArray.filter((tx: any) => tx.date.startsWith(month) && tx.status === 'done')
      const income = monthTxs.filter((t: any) => t.type === 'income').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      const expense = monthTxs.filter((t: any) => t.type === 'expense' || t.type === 'sangria').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      return {
        name: format(new Date(month + '-01'), 'MMM', { locale: ptBR }).toUpperCase(),
        Receitas: income,
        Despesas: expense,
        Saldo: income - expense,
      }
    })

    // Acumulado
    let runningBalance = 0
    const accumulated = monthlyData.map(d => {
      runningBalance += d.Saldo
      return { ...d, 'Saldo Acumulado': runningBalance }
    })

    setData(accumulated)
    setLoading(false)
  }, [user, context, filters])

  useEffect(() => { loadData() }, [loadData])

  const handleExportPDF = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const tableRows = data.map(d => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${d.name}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;color:#059669;">${formatCurrency(d.Receitas)}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;color:#dc2626;">${formatCurrency(d.Despesas)}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;color:${d.Saldo >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(d.Saldo)}</td>
        <td style="padding:8px;text-align:right;border-bottom:1px solid #e5e7eb;color:${d['Saldo Acumulado'] >= 0 ? '#059669' : '#dc2626'};">${formatCurrency(d['Saldo Acumulado'])}</td>
      </tr>
    `).join('')

    const html = `
      <html>
        <head>
          <title>Fluxo de Caixa - DFL Finance</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h2 { color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th { padding: 8px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 11px; text-transform: uppercase; color: #64748b; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h2>Fluxo de Caixa</h2>
          <table>
            <thead><tr><th>Mês</th><th style="text-align:right">Receitas</th><th style="text-align:right">Despesas</th><th style="text-align:right">Saldo</th><th style="text-align:right">Acumulado</th></tr></thead>
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
    const header = 'Mês,Receitas,Despesas,Saldo,Acumulado\n'
    const rows = data.map(d => `"${d.name}",${d.Receitas.toFixed(2)},${d.Despesas.toFixed(2)},${d.Saldo.toFixed(2)},${d['Saldo Acumulado'].toFixed(2)}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fluxo-de-caixa.csv`
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
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Fluxo de Caixa</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(val: number) => formatCurrency(val)} />
            <Legend />
            <Area type="monotone" dataKey="Receitas" stroke="#22c55e" fill="#22c55e20" strokeWidth={2} />
            <Area type="monotone" dataKey="Despesas" stroke="#ef4444" fill="#ef444420" strokeWidth={2} />
            <Area type="monotone" dataKey="Saldo Acumulado" stroke="#14b8a6" fill="url(#colorSaldo)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Resumo Mensal</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-gray-500">
                <th className="text-left py-2">Mês</th>
                <th className="text-right py-2">Receitas</th>
                <th className="text-right py-2">Despesas</th>
                <th className="text-right py-2">Saldo</th>
                <th className="text-right py-2">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.name} className="border-b border-gray-50 dark:border-slate-700">
                  <td className="py-3 font-bold text-gray-800 dark:text-gray-200">{row.name}</td>
                  <td className="text-right text-emerald-600 font-bold">{formatCurrency(row.Receitas)}</td>
                  <td className="text-right text-red-500 font-bold">{formatCurrency(row.Despesas)}</td>
                  <td className={`text-right font-bold ${row.Saldo >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(row.Saldo)}</td>
                  <td className={`text-right font-bold ${row['Saldo Acumulado'] >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(row['Saldo Acumulado'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
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