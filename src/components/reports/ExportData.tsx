'use client'

import React, { useState, useEffect } from 'react'
import { Download, FileText, FileJson } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { ReportFilterValues } from './ReportFilters'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

interface ExportDataProps {
  filters: ReportFilterValues
}

export default function ExportData({ filters }: ExportDataProps) {
  const { user } = useAuth()
  const { vibrate, success } = useHapticFeedback()
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
    vibrate([10])
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
    
    success()
    setExporting(false)
  }

  const exportJSON = () => {
    if (!transactions.length) return
    vibrate([10])
    setExporting(true)

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

    success()
    setExporting(false)
  }

  const incomeTotal = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + Number(t.amount), 0)
  const expenseTotal = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + Number(t.amount), 0)

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
              {transactions.length}
            </p>
            <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6">
              Transações Encontradas
            </p>
            
            <div className="grid grid-cols-2 gap-4 w-full">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-[16px] text-center border border-emerald-100 dark:border-emerald-500/20">
                <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest mb-1">Receitas</p>
                <p className="font-bold text-[14px] text-emerald-600">R$ {fmt(incomeTotal)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-[16px] text-center border border-red-100 dark:border-red-500/20">
                <p className="text-[10px] font-bold text-red-600/70 uppercase tracking-widest mb-1">Despesas</p>
                <p className="font-bold text-[14px] text-red-500">R$ {fmt(expenseTotal)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            <button
              onClick={exportCSV}
              disabled={exporting || !transactions.length}
              className="w-full flex items-center justify-center gap-3 p-4 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white rounded-[24px] font-bold text-[15px] transition-all active:scale-[0.98] shadow-lg shadow-teal-600/30 disabled:shadow-none"
            >
              <FileText size={20} />
              Exportar para Excel (CSV)
            </button>

            <button
              onClick={exportJSON}
              disabled={exporting || !transactions.length}
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
