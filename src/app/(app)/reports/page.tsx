'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { exportTransactionsToCSV, exportAnalysisToCSV, downloadCSV } from '@/lib/services/exportService'
import { ChevronLeft, Download, Calendar, AlertCircle, Loader } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ReportsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [context, setContext] = useState<'dfl' | 'personal'>('dfl')
  const [range, setRange] = useState('30')
  const [month, setMonth] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleExportTransactions = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      const blob = await exportTransactionsToCSV(user.id, context, range)
      const filename = `extrato-${context}-${new Date().toISOString().split('T')[0]}.csv`
      downloadCSV(blob, filename)
    } catch (err: any) {
      setError(err.message || 'Erro ao exportar.')
    } finally {
      setLoading(false)
    }
  }, [user, context, range])

  const handleExportAnalysis = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')
    try {
      const selectedMonth = new Date(month)
      const blob = await exportAnalysisToCSV(user.id, context, selectedMonth)
      const filename = `analise-${context}-${month}.csv`
      downloadCSV(blob, filename)
    } catch (err: any) {
      setError(err.message || 'Erro ao exportar.')
    } finally {
      setLoading(false)
    }
  }, [user, context, month])

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24 pt-6 px-5">

      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <ChevronLeft size={24} className="text-gray-700" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        
        {/* Extrato */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-lg text-gray-900 mb-4">Extrato de Transações</h2>
          
          <div className="flex bg-gray-100 p-1 rounded-full mb-4 w-fit">
            {(['dfl', 'personal'] as const).map(c => (
              <button key={c} onClick={() => setContext(c)}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${context===c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {c==='dfl'?'DFL':'Pessoal'}
              </button>
            ))}
          </div>

          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Período</label>
          <select
            value={range}
            onChange={e => setRange(e.target.value)}
            className="w-full bg-gray-100 p-3.5 rounded-xl outline-none text-sm font-semibold mb-4"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="365">Último ano</option>
            <option value="total">Tudo</option>
          </select>

          <button
            onClick={handleExportTransactions}
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader size={18} className="animate-spin" /> : <Download size={18} />}
            Exportar CSV
          </button>
        </div>

        {/* Análise */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h2 className="font-bold text-lg text-gray-900 mb-4">Análise Mensal</h2>

          <div className="flex bg-gray-100 p-1 rounded-full mb-4 w-fit">
            {(['dfl', 'personal'] as const).map(c => (
              <button key={c} onClick={() => setContext(c)}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${context===c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
                {c==='dfl'?'DFL':'Pessoal'}
              </button>
            ))}
          </div>

          <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Mês</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value + '-01')}
            className="w-full bg-gray-100 p-3.5 rounded-xl outline-none text-sm font-semibold mb-4"
          />

          <button
            onClick={handleExportAnalysis}
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3.5 rounded-xl font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader size={18} className="animate-spin" /> : <Download size={18} />}
            Exportar Análise
          </button>
        </div>

      </div>
    </div>
  )
}