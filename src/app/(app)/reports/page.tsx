'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, RefreshCw, TrendingUp, TrendingDown, Wallet,
  Download, FileText, FileSpreadsheet, CheckCircle,
  BarChart3, Loader2, X
} from 'lucide-react'
import { format, subMonths, eachDayOfInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { exportTransactionsToCSV, downloadCSV } from '@/lib/services/exportService'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart as ReLineChart, Line
} from 'recharts'

// 🔥 SKELETON ATUALIZADO
const ReportsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] p-4 shadow-sm border border-gray-200/70 dark:border-slate-700 text-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
          <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
          <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
        </div>
      ))}
    </div>
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-200/70 dark:border-slate-700">
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-[200px] bg-gray-100 dark:bg-slate-700/50 rounded-[18px]" />
    </div>
  </div>
)

// 🔥 EXPORT MODAL ATUALIZADO
function ExportModal({ isOpen, onClose, onExport, exportStatus }: {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'pdf' | 'csv') => void;
  exportStatus: 'idle' | 'exporting' | 'success'
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={exportStatus === 'exporting' ? undefined : onClose}>
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 animate-in slide-in-from-bottom-10 duration-300 shadow-2xl" onClick={e => e.stopPropagation()}>

        {exportStatus === 'success' ? (
          <div className="flex flex-col items-center justify-center py-8 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
              <CheckCircle size={40} className="text-emerald-500 animate-bounce" />
            </div>
            <h3 className="font-black text-xl text-gray-800 dark:text-gray-100 mb-2 text-center">Relatório Gerado!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-[280px] mb-8 font-medium">
              O download foi iniciado. Acesse a <strong className="text-emerald-600 dark:text-emerald-400">pasta de downloads</strong> do seu dispositivo para abrir o arquivo.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 py-4 rounded-[20px] font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors active:scale-[0.98]"
            >
              Concluir
            </button>
          </div>
        ) : (
          <>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />

            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Exportar Relatório</h3>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Escolha o formato para exportar os dados
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-10 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-400 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors active:scale-[0.98]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onExport('pdf')}
                disabled={exportStatus === 'exporting'}
                className="flex-1 h-12 rounded-[20px] bg-teal-600 hover:bg-teal-700 text-white font-bold text-[14px] shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {exportStatus === 'exporting' ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
                PDF
              </button>

              <button
                type="button"
                onClick={() => onExport('csv')}
                disabled={exportStatus === 'exporting'}
                className="flex-1 h-12 rounded-[20px] bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-[14px] hover:bg-gray-200 dark:hover:bg-slate-600 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {exportStatus === 'exporting' ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                CSV
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context, effectiveContext } = useContext_()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('3m')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

  const [showExportModal, setShowExportModal] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success'>('idle')

  const { data: localTransactions, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)
    try {
      await reloadTransactions()
    } catch (err) {
      console.error('Erro ao carregar transações:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [user?.id, reloadTransactions])

  useEffect(() => {
    if (user?.id && context) {
      loadData()
    }
  }, [user?.id, context, loadData])

  const transactions = localTransactions || []

  const endDate = new Date()
  const startDate = subMonths(endDate, parseInt(period))
  const filteredByPeriod = transactions.filter((t: any) => {
    const txDate = new Date(t.date)
    return txDate >= startDate && txDate <= endDate
  })

  const filteredTransactions = filterType === 'all'
    ? filteredByPeriod
    : filteredByPeriod.filter((t: any) => t.type === filterType)

  const totalIncome = filteredByPeriod.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Number(t.amount), 0)
  const totalExpense = filteredByPeriod.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Number(t.amount), 0)
  const balance = totalIncome - totalExpense

  const categoryData = filteredTransactions.reduce((acc: any[], t: any) => {
    const categoryName = t.categories?.name || 'Outros'
    const existing = acc.find(item => item.name === categoryName)
    if (existing) {
      existing.value += Number(t.amount)
    } else {
      acc.push({ name: categoryName, value: Number(t.amount) })
    }
    return acc
  }, []).sort((a, b) => b.value - a.value).slice(0, 6)

  const COLORS = ['#14b8a6', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  const monthlyData = filteredByPeriod.reduce((acc: any[], t: any) => {
    const monthKey = format(new Date(t.date), 'yyyy-MM')
    const existing = acc.find(item => item.month === monthKey)
    if (existing) {
      if (t.type === 'income') existing.income += Number(t.amount)
      else existing.expense += Number(t.amount)
    } else {
      acc.push({
        month: monthKey,
        label: format(new Date(t.date), 'MMM/yy', { locale: ptBR }),
        income: t.type === 'income' ? Number(t.amount) : 0,
        expense: t.type === 'expense' ? Number(t.amount) : 0,
      })
    }
    return acc
  }, []).sort((a, b) => a.month.localeCompare(b.month))

  const dailyData = (() => {
    const today = new Date()
    const start = subMonths(today, 1)
    const days = eachDayOfInterval({ start, end: today })

    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayTransactions = filteredByPeriod.filter((t: any) => t.date === dayStr)
      const income = dayTransactions.filter((t: any) => t.type === 'income').reduce((acc: number, t: any) => acc + Number(t.amount), 0)
      const expense = dayTransactions.filter((t: any) => t.type === 'expense').reduce((acc: number, t: any) => acc + Number(t.amount), 0)
      return { date: format(day, 'dd/MM'), income, expense, balance: income - expense }
    })
  })()

  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!user?.id) return

    if (format === 'pdf') {
      showToast('A exportação em PDF estará disponível em breve.', 'info')
      return
    }

    setExportStatus('exporting')
    try {
      const daysRange = (parseInt(period) * 30).toString()
      const { csv, filename } = await exportTransactionsToCSV(user.id, effectiveContext, daysRange)

      downloadCSV(csv, filename)

      setExportStatus('success')

      setTimeout(() => {
        setShowExportModal(false)
        setExportStatus('idle')
      }, 5000)

    } catch (err: any) {
      console.error(err)
      showToast(err.message || 'Erro ao exportar relatório.', 'error')
      setExportStatus('idle')
    }
  }

  const periods = [
    { key: '1m', label: '1 mês' },
    { key: '3m', label: '3 meses' },
    { key: '6m', label: '6 meses' },
    { key: '12m', label: '12 meses' },
  ]

  const filterOptions = [
    { key: 'all', label: 'Todas' },
    { key: 'income', label: 'Receitas' },
    { key: 'expense', label: 'Despesas' },
  ]

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
      )}

      <div className="sticky top-0 z-40 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => router.push('/home')}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                  <BarChart3 size={18} className="text-teal-500" />
                  Relatórios
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Análise consolidada do período
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="h-11 w-11 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98] shrink-0"
            >
              <RefreshCw size={18} className={loadingPulse ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="mb-3">
            <ContextToggle />
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-1 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-1 shadow-sm">
              {periods.map(p => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key as any)}
                  className={`h-9 px-3 rounded-[14px] text-[12px] font-semibold transition-all active:scale-[0.98] ${
                    period === p.key
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-1 shadow-sm">
              {filterOptions.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterType(f.key as any)}
                  className={`h-9 px-3 rounded-[14px] text-[12px] font-semibold transition-all active:scale-[0.98] ${
                    filterType === f.key
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-4">
        {loading ? (
          <ReportsSkeleton />
        ) : filteredByPeriod.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <BarChart3 size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-semibold text-[16px] text-gray-800 dark:text-gray-100 mb-1">
              Nenhum dado disponível
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-[12px] max-w-[250px]">
              Não há transações no período selecionado.
            </p>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4">
                <div className="w-9 h-9 rounded-[14px] bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
                  <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1">
                  Receitas
                </p>
                <p className="text-[16px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {formatCurrency(totalIncome)}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4">
                <div className="w-9 h-9 rounded-[14px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-3">
                  <TrendingDown size={16} className="text-red-500" />
                </div>
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1">
                  Despesas
                </p>
                <p className="text-[16px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {formatCurrency(totalExpense)}
                </p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4">
                <div className="w-9 h-9 rounded-[14px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center mb-3">
                  <Wallet size={16} className="text-teal-600 dark:text-teal-400" />
                </div>
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1">
                  Saldo
                </p>
                <p className={`text-[16px] font-bold tracking-tight ${balance >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-500'}`}>
                  {formatCurrency(balance)}
                </p>
              </div>
            </div>

            {monthlyData.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
                <div className="mb-4">
                  <h3 className="font-semibold text-[14px] text-gray-900 dark:text-gray-100">
                    Evolução mensal
                  </h3>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Receitas e despesas por mês
                  </p>
                </div>

                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ fontSize: 12, borderRadius: 12 }} />
                      <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {categoryData.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
                  <div className="mb-3">
                    <h3 className="font-semibold text-[14px] text-gray-900 dark:text-gray-100">
                      Categorias
                    </h3>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Distribuição por valor
                    </p>
                  </div>

                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={2}>
                          {categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ fontSize: 10, borderRadius: 12 }} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {dailyData.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
                  <div className="mb-3">
                    <h3 className="font-semibold text-[14px] text-gray-900 dark:text-gray-100">
                      Saldo diário
                    </h3>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                      Últimos 30 dias
                    </p>
                  </div>

                  <div className="h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ReLineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 8 }} interval={4} />
                        <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `R$${v}`} />
                        <Tooltip formatter={(v: any) => formatCurrency(v)} contentStyle={{ fontSize: 10, borderRadius: 12 }} />
                        <Line type="monotone" dataKey="balance" stroke="#14b8a6" strokeWidth={2} dot={false} />
                      </ReLineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setExportStatus('idle')
                setShowExportModal(true)
              }}
              className="w-full bg-teal-700 text-white py-4 rounded-[20px] font-bold text-[14px] hover:bg-teal-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20 active:scale-[0.98]"
            >
              <Download size={18} />
              Exportar relatório
            </button>
          </div>
        )}
      </div>

      <ExportModal
        isOpen={showExportModal}
        onClose={() => {
          setShowExportModal(false)
          setExportStatus('idle')
        }}
        onExport={handleExport}
        exportStatus={exportStatus}
      />
    </div>
  )
}