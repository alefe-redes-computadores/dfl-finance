'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'
import { FilterState } from './ReportFilters'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Loader2, Download } from 'lucide-react'

interface Props {
  filters: FilterState
  onClose: () => void
}

export default function ComparePeriods({ filters, onClose }: Props) {
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
    // Comparar mês atual com mês passado
    const periods = [
      {
        label: 'Mês Atual',
        start: format(startOfMonth(today), 'yyyy-MM-dd'),
        end: format(endOfMonth(today), 'yyyy-MM-dd'),
      },
      {
        label: 'Mês Passado',
        start: format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'),
        end: format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd'),
      },
      {
        label: '2 Meses Atrás',
        start: format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd'),
        end: format(endOfMonth(subMonths(today, 2)), 'yyyy-MM-dd'),
      },
    ]

    const allStart = periods[2].start
    const allEnd = periods[0].end

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, type, date, status')
      .match({ user_id: user.id, context: context })
      .gte('date', allStart)
      .lte('date', allEnd)

    const txArray = Array.isArray(txs) ? txs : []

    const result = periods.map(p => {
      const periodTxs = txArray.filter((tx: any) => tx.date >= p.start && tx.date <= p.end && tx.status === 'done')
      const income = periodTxs.filter((t: any) => t.type === 'income').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      const expense = periodTxs.filter((t: any) => t.type === 'expense' || t.type === 'sangria').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      return {
        name: p.label,
        Receitas: income,
        Despesas: expense,
        Saldo: income - expense,
      }
    })

    setData(result)
    setLoading(false)
  }, [user, context, filters])

  useEffect(() => { loadData() }, [loadData])

  const handleExportCSV = () => {
    const header = 'Período,Receitas,Despesas,Saldo\n'
    const rows = data.map(d => `"${d.name}",${d.Receitas.toFixed(2)},${d.Despesas.toFixed(2)},${d.Saldo.toFixed(2)}`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `comparar-periodos.csv`
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
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Comparar Períodos</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(val: number) => formatCurrency(val)} />
            <Legend />
            <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <button onClick={handleExportCSV} className="w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl py-3 text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2">
        <Download size={18} /> Exportar CSV
      </button>
    </div>
  )
}