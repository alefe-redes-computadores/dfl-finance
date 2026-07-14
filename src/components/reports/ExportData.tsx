'use client'

import React, { useState, useEffect } from 'react'
import { Download, FileText, FileJson } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { format, parseISO } from 'date-fns'
import { ReportFilterValues } from './ReportFilters'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { safeNumber, safeFormatDate, safeArray } from '@/lib/safe'

interface TransactionItem {
  id: string
  date: string
  description?: string | null
  category?: string | null
  category_id?: string | null
  amount: number | string
  type: 'income' | 'expense'
  status?: string | null
  context?: string | null
  account_id?: string | null
  credit_card_id?: string | null
  tag_ids?: string[] | null
}

interface CategoryItem {
  id: string
  name: string
}

interface ExportDataProps {
  filters: ReportFilterValues
}

export default function ExportData({ filters }: ExportDataProps) {
  const { user } = useAuth()
  const { vibrate, success } = useHapticFeedback()
  const [isClient, setIsClient] = useState(false)
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<TransactionItem[]>([])
  const [categories, setCategories] = useState<Record<string, CategoryItem>>({})
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { context, dateRange } = filters
  const { start = '', end = '' } = dateRange
  const { tags = [], accounts = [], creditCards = [] } = filters

  // 🔥 SUBSTITUÍDO: useEffect com query com join e dependências quebradas
  useEffect(() => {
    if (!user?.id) {
      setTransactions([])
      setCategories({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    const load = async () => {
      let query = supabase
        .from('transactions')
        .select(`
          id,
          date,
          description,
          category,
          category_id,
          amount,
          type,
          status,
          context,
          account_id,
          credit_card_id,
          tag_ids
        `)
        .eq('user_id', user.id)
        .eq('context', context)
        .order('date', { ascending: false })

      if (start) query = query.gte('date', start)
      if (end) query = query.lte('date', end)
      if (tags?.length) query = query.overlaps('tag_ids', tags)
      if (accounts?.length) query = query.in('account_id', accounts)
      if (creditCards?.length) query = query.in('credit_card_id', creditCards)

      const [txResult, catResult] = await Promise.all([
        query,
        supabase.from('categories').select('id, name').eq('user_id', user.id),
      ])

      if (cancelled) return

      if (txResult.error) console.error('ExportData TX:', txResult.error)
      if (catResult.error) console.error('ExportData CAT:', catResult.error)

      const catMap: Record<string, CategoryItem> = {}
      ;(catResult.data || []).forEach((c: CategoryItem) => {
        catMap[c.id] = c
      })

      setCategories(catMap)
      setTransactions((txResult.data as TransactionItem[]) || [])
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [user?.id, context, start, end, tags, accounts, creditCards])

  const fmt = (val: unknown) => {
    const num = safeNumber(val)
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const fmtDate = (str: string) => {
    if (!str) return 'Data inválida'
    return safeFormatDate(str, 'dd/MM/yyyy')
  }

  // 🔥 SUBSTITUÍDO: getCatName com tipagem
  const getCatName = (t: TransactionItem) =>
    (t.category_id && categories[t.category_id]?.name) || t.category || ''

  // 🔥 SUBSTITUÍDO: exportCSV com isClient e try/catch
  const exportCSV = () => {
    if (!transactions.length || !isClient) return
    vibrate([10])
    setExporting(true)

    try {
      const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)', 'Status', 'Contexto']

      const rows = (Array.isArray(transactions) ? transactions : []).map((t) => [
        fmtDate(t?.date || ''),
        `"${(t?.description || '').replace(/"/g, '""')}"`,
        getCatName(t),
        t?.type === 'income' ? 'Receita' : 'Despesa',
        fmt(safeNumber(t?.amount)),
        t?.status === 'done' ? 'Pago' : 'Pendente',
        t?.context === 'personal' ? 'Pessoal' : 'DFL',
      ])

      const csv = '\uFEFF' + [headers, ...rows].map((r) => r.join(';')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dfl-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)

      success()
    } catch (error) {
      console.error('Erro ao exportar CSV:', error)
    } finally {
      setExporting(false)
    }
  }

  // 🔥 SUBSTITUÍDO: exportJSON com isClient e try/catch
  const exportJSON = () => {
    if (!transactions.length || !isClient) return
    vibrate([10])
    setExporting(true)

    try {
      const enriched = (Array.isArray(transactions) ? transactions : []).map((t) => ({
        ...t,
        category_name: getCatName(t),
        amount_number: safeNumber(t?.amount),
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
    } catch (error) {
      console.error('Erro ao exportar JSON:', error)
    } finally {
      setExporting(false)
    }
  }

  const incomeTotal = (Array.isArray(transactions) ? transactions : [])
    .filter((t) => t?.type === 'income')
    .reduce((s, t) => s + safeNumber(t?.amount), 0)

  const expenseTotal = (Array.isArray(transactions) ? transactions : [])
    .filter((t) => t?.type === 'expense')
    .reduce((s, t) => s + safeNumber(t?.amount), 0)

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
                <p className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest mb-1">
                  Receitas
                </p>
                <p className="font-bold text-[14px] text-emerald-600">R$ {fmt(incomeTotal)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-500/10 p-3 rounded-[16px] text-center border border-red-100 dark:border-red-500/20">
                <p className="text-[10px] font-bold text-red-600/70 uppercase tracking-widest mb-1">
                  Despesas
                </p>
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