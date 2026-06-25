'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { FilterState } from './ReportFilters'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Loader2, Download, FileText } from 'lucide-react'

interface Props {
  filters: FilterState
  onClose: () => void
}

export default function CategoryResult({ filters, onClose }: Props) {
  const { user } = useAuth()
  const { context } = useContext_()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie')

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    let start: string, end: string
    const today = new Date()

    switch (filters.period) {
      case 'this-month':
        start = format(startOfMonth(today), 'yyyy-MM-dd')
        end = format(endOfMonth(today), 'yyyy-MM-dd')
        break
      case 'last-month':
        start = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
        end = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd')
        break
      case 'last-3-months':
        start = format(startOfMonth(subMonths(today, 3)), 'yyyy-MM-dd')
        end = format(endOfMonth(today), 'yyyy-MM-dd')
        break
      default:
        start = format(startOfMonth(today), 'yyyy-MM-dd')
        end = format(endOfMonth(today), 'yyyy-MM-dd')
    }

    const { data: txs } = await supabase
      .from('transactions')
      .select('*, categories(name, icon, color)')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)

    const txArray = Array.isArray(txs) ? txs : []

    const catMap: Record<string, { income: number; expense: number; icon: string; color: string }> = {}
    txArray.forEach((tx: any) => {
      const name = tx.categories?.name || 'Outros'
      if (!catMap[name]) {
        catMap[name] = {
          income: 0,
          expense: 0,
          icon: tx.categories?.icon || 'other',
          color: tx.categories?.color || '#64748b',
        }
      }
      if (tx.type === 'income') {
        catMap[name].income += Number(tx.amount || 0)
      } else if (tx.type === 'expense' || tx.type === 'sangria') {
        catMap[name].expense += Number(tx.amount || 0)
      }
    })

    const result = Object.entries(catMap)
      .map(([name, vals]) => ({
        name,
        income: vals.income,
        expense: vals.expense,
        balance: vals.income - vals.expense,
        icon: vals.icon,
        color: vals.color,
      }))
      .sort((a, b) => b.balance - a.balance)

    setData(result)
    setLoading(false)
  }, [user, context, filters])

  useEffect(() => { loadData() }, [loadData])

  const handleExportPDF = () => {
    alert('Exportação PDF em breve')
  }

  const handleExportCSV = () => {
    const header = 'Categoria,Receitas,Despesas,Saldo\n'
    const rows = data.map(d => `"${d.name}",${d.income.toFixed(2)},${d.expense.toFixed(2)},${d.balance.toFixed(2)}`).join('\n')
    const csv = header + rows
    const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `resultado-por-categoria-${filters.period}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  if (data.length === 0) {
    return <p className="text-center py-20 text-gray-400 dark:text-gray-500">Nenhum dado no período.</p>
  }

  return (
    <div className="space-y-6">
      {/* Toggle tipo de gráfico */}
      <div className="flex gap-2 justify-end">
        <button onClick={() => setChartType('pie')} className={`px-3 py-1 rounded-full text-xs font-bold ${chartType === 'pie' ? 'bg-teal-700 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>Pizza</button>
        <button onClick={() => setChartType('bar')} className={`px-3 py-1 rounded-full text-xs font-bold ${chartType === 'bar' ? 'bg-teal-700 text-white' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-400'}`}>Barras</button>
      </div>

      {/* Gráfico */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Resultado por Categoria</h3>
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'pie' ? (
            <PieChart>
              <Pie data={data} dataKey="balance" nameKey="name" cx="50%" cy="50%" outerRadius={100} paddingAngle={2} stroke="none">
                {data.map((entry, i) => (
                  <Cell key={`cell-${i}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(val: number) => formatCurrency(val)} />
            </PieChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(val: number) => formatCurrency(val)} />
              <Bar dataKey="income" fill="#22c55e" name="Receitas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#ef4444" name="Despesas" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Tabela */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Detalhamento</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-gray-400 dark:text-gray-500">
                <th className="text-left py-2">Categoria</th>
                <th className="text-right py-2">Receitas</th>
                <th className="text-right py-2">Despesas</th>
                <th className="text-right py-2">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => {
                const IconComp = getDynamicIcon(row.icon)
                return (
                  <tr key={row.name} className="border-b border-gray-50 dark:border-slate-700">
                    <td className="py-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${row.color}20`, color: row.color }}>
                        <IconComp size={12} />
                      </div>
                      <span className="font-bold text-gray-800 dark:text-gray-200">{row.name}</span>
                    </td>
                    <td className="text-right text-emerald-600 font-bold">{formatCurrency(row.income)}</td>
                    <td className="text-right text-red-500 font-bold">{formatCurrency(row.expense)}</td>
                    <td className={`text-right font-bold ${row.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(row.balance)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exportação */}
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