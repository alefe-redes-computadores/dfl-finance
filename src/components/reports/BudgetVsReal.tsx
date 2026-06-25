'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { FilterState } from './ReportFilters'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { Loader2, Download } from 'lucide-react'

interface Props {
  filters: FilterState
  onClose: () => void
}

export default function BudgetVsReal({ filters, onClose }: Props) {
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

    const [{ data: budgets }, { data: txs }] = await Promise.all([
      supabase.from('budgets').select('*, categories(name, icon, color)').match({ user_id: user.id, context: context }),
      supabase.from('transactions').select('category_id, amount, type, status').match({ user_id: user.id, context: context }).gte('date', start).lte('date', end),
    ])

    const budgetsArray = Array.isArray(budgets) ? budgets : []
    const txsArray = Array.isArray(txs) ? txs : []

    const result = budgetsArray.map((budget: any) => {
      const spent = txsArray
        .filter((t: any) => t.category_id === budget.category_id && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
        .reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      const planned = Number(budget.amount) || 0
      const diff = planned - spent
      return {
        name: budget.name || budget.categories?.name || 'Sem nome',
        icon: budget.categories?.icon || 'other',
        color: budget.categories?.color || '#64748b',
        previsto: planned,
        gasto: spent,
        diff,
        percent: planned > 0 ? (spent / planned) * 100 : 0,
      }
    })

    setData(result.sort((a: any, b: any) => b.percent - a.percent))
    setLoading(false)
  }, [user, context, filters])

  useEffect(() => { loadData() }, [loadData])

  const handleExportCSV = () => {
    const header = 'Orçamento,Previsto,Gasto,Diferença,Percentual\n'
    const rows = data.map(d => `"${d.name}",${d.previsto.toFixed(2)},${d.gasto.toFixed(2)},${d.diff.toFixed(2)},${d.percent.toFixed(0)}%`).join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv; charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `previsto-x-realizado.csv`
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
    return <p className="text-center py-20 text-gray-400 dark:text-gray-500">Nenhum orçamento cadastrado.</p>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Previsto x Realizado</h3>
        <div className="space-y-4">
          {data.map(row => {
            const IconComp = getDynamicIcon(row.icon)
            const isOver = row.gasto > row.previsto
            return (
              <div key={row.name}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${row.color}20`, color: row.color }}>
                      <IconComp size={14} />
                    </div>
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{row.name}</span>
                  </div>
                  <span className={`text-xs font-bold ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>
                    {row.percent.toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 dark:text-gray-500 mb-1">
                  <span>Gasto: {formatCurrency(row.gasto)}</span>
                  <span>Previsto: {formatCurrency(row.previsto)}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                  <div className={`h-full rounded-full ${isOver ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(row.percent, 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <button onClick={handleExportCSV} className="w-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl py-3 text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center justify-center gap-2">
        <Download size={18} /> Exportar CSV
      </button>
    </div>
  )
}