'use client'

import React, { useState, useEffect } from 'react'
import { Download, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { ReportFilterValues } from './ReportFilters'

interface ExportDataProps {
  filters: ReportFilterValues
}

export default function ExportData({ filters }: ExportDataProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)

    const load = async () => {
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })

      if (filters.dateRange.start) query = query.gte('date', filters.dateRange.start)
      if (filters.dateRange.end) query = query.lte('date', filters.dateRange.end)
      if (filters.context === 'personal') query = query.eq('context', 'personal')

      const { data, error } = await query
      if (error) console.error(error)
      setTransactions(data || [])
      setLoading(false)
    }

    load()
  }, [user?.id, filters])

  const exportCSV = () => {
    if (!transactions.length) return
    setExporting(true)
    const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status']
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.description,
      t.category || '',
      t.type === 'income' ? 'Receita' : 'Despesa',
      t.amount.toFixed(2),
      t.status || 'completed'
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
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
    const json = JSON.stringify(transactions, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dfl-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExporting(false)
  }

  return (
    <div className="flex-1">
      {loading ? (
        <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl text-center">
            <p className="text-3xl font-bold text-teal-600">{transactions.length}</p>
            <p className="text-sm text-slate-500">transações disponíveis</p>
          </div>
          <button onClick={exportCSV} disabled={exporting || !transactions.length} className="w-full flex items-center justify-center p-4 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 text-white rounded-xl font-semibold">
            <FileText size={20} className="mr-2" /> Exportar CSV
          </button>
          <button onClick={exportJSON} disabled={exporting || !transactions.length} className="w-full flex items-center justify-center p-4 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl font-semibold">
            <Download size={20} className="mr-2" /> Exportar JSON
          </button>
        </div>
      )}
    </div>
  )
}