'use client'

import React, { useState, useEffect } from 'react'
import { Download, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { ReportFilterValues } from './ReportFilters'

interface ExportDataProps {
  filters: ReportFilterValues
}

export default function ExportData({ filters }: ExportDataProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [categories, setCategories] = useState<Record<string, any>>({})
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    setLoading(true)

    const load = async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('context', filters.context)
        .order('date', { ascending: false })

      if (filters.dateRange.start) query = query.gte('date', filters.dateRange.start)
      if (filters.dateRange.end) query = query.lte('date', filters.dateRange.end)

      const [txResult, catResult] = await Promise.all([
        query,
        supabase.from('categories').select('id, name').eq('user_id', user.id),
      ])

      if (cancelled) return

      if (txResult.error) console.error('ExportData TX:', txResult.error)
      if (catResult.error) console.error('ExportData CAT:', catResult.error)

      const catMap: Record<string, any> = {}
      ;(catResult.data || []).forEach((c: any) => { catMap[c.id] = c })

      setCategories(catMap)
      setTransactions(txResult.data || [])
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [user?.id, filters.context, filters.dateRange.start, filters.dateRange.end])

  const fmt = (val: number) =>
    Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const fmtDate = (str: string) => {
    try { return format(parseISO(str), 'dd/MM/yyyy') } catch { return str }
  }

  const getCatName = (t: any) =>
    categories[t.category_id]?.name || t.category || ''

  const exportCSV = () => {
    if (!transactions.length) return
    setExporting(true)

    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)', 'Status', 'Contexto']
    const rows = transactions.map(t => [
      fmtDate(t.date),
      `"${(t.description || '').replace(/"/g, '""')}"`,
      getCatName(t),
      t.type === 'income' ? 'Receita' : 'Despesa',
      fmt(Number(t.amount)),
      t.status === 'done' ? 'Pago' : 'Pendente',
      t.context === 'personal' ? 'Pessoal' : 'DFL',
    ])

    const csv = '\uFEFF' + [headers, ...rows].map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dfl-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  const exportJSON = () => {
    if (!transactions.length) return
    setExporting(true)

    // Enriquece o JSON com o nome da categoria antes de exportar
    const enriched = transactions.map(t => ({
      ...t,
      category_name: getCatName(t),
    }))

    const json = JSON.stringify(enriched, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dfl-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  const incomeTotal = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0)
  const expenseTotal = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
            <p className="text-3xl font-bold text-teal-600 text-center">{transactions.length}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-3">
              transações no período
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Receitas</p>
                <p className="font-bold text-emerald-600">R$ {fmt(incomeTotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-1">Despesas</p>
                <p className="font-bold text-red-600">R$ {fmt(expenseTotal)}</p>
              </div>
            </div>
          </div>

          <button
            onClick={exportCSV}
            disabled={exporting || !transactions.length}
            className="w-full flex items-center justify-center gap-2 p-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white rounded-xl font-semibold transition-colors"
          >
            <FileText size={20} />
            Exportar CSV
          </button>

          <button
            onClick={exportJSON}
            disabled={exporting || !transactions.length}
            className="w-full flex items-center justify-center gap-2 p-4 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl font-semibold transition-colors"
          >
            <Download size={20} />
            Exportar JSON
          </button>

          {!transactions.length && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              Nenhuma transação no período selecionado.
            </p>
          )}
        </div>
      )}
    </div>
  )
}