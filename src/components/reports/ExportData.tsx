'use client'

import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { useContext_ } from '@/components/ContextToggle'
import ReportFilters, { ReportFilterValues } from '@/components/reports/ReportFilters'
import { Loader2, Download, Check, FileText } from 'lucide-react'

export default function ExportData() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [filters, setFilters] = useState<ReportFilterValues>({
    context,
    dateRange: { start: '', end: '' },
    preset: 'thisMonth',
  })

  const handleExportCSV = async () => {
    if (!user || !filters.dateRange.start) return
    setLoading(true)
    setExportStatus('loading')

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', filters.dateRange.start)
      .lte('date', filters.dateRange.end)
      .order('date', { ascending: false })

    const txs = Array.isArray(transactions) ? transactions : []

    if (txs.length === 0) {
      alert('Nenhuma transação encontrada.')
      setLoading(false)
      setExportStatus('idle')
      return
    }

    const csvContent = 'Data,Descrição,Tipo,Valor,Categoria,Status\n' + txs.map(t => 
      [t.date, `"${t.description || ''}"`, t.type, t.amount, t.category_id, t.status].join(',')
    ).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `transacoes-${filters.dateRange.start}.csv`
    link.click()
    
    setLoading(false)
    setExportStatus('done')
    setTimeout(() => setExportStatus('idle'), 3000)
  }

  return (
    <div className="space-y-4">
      <ReportFilters onChange={setFilters} initialPreset="thisMonth" />
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-50 dark:border-slate-700">
        <button onClick={handleExportCSV} disabled={loading} className="w-full py-3 rounded-xl bg-teal-700 text-white font-bold text-sm">
          {loading ? 'Exportando...' : exportStatus === 'done' ? 'Exportado!' : 'Baixar CSV'}
        </button>
      </div>
    </div>
  )
}
