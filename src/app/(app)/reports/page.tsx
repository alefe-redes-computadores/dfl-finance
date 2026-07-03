'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, RefreshCw, TrendingUp, TrendingDown, Wallet,
  Calendar, Filter, Download, FileText, FileSpreadsheet,
  BarChart3, PieChart, LineChart, Loader2
} from 'lucide-react'
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { formatCurrency } from '@/lib/utils'
import dynamic from 'next/dynamic'

// ============================================================
// LAZY LOADING DOS GRÁFICOS (Recharts)
// ============================================================
const BarChartComponent = dynamic(
  () => import('recharts').then(mod => mod.BarChart),
  { ssr: false, loading: () => <div className="h-[200px] bg-gray-100 dark:bg-slate-700/50 rounded-xl animate-pulse" /> }
)
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false })
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false })
const PieChartComponent = dynamic(
  () => import('recharts').then(mod => mod.PieChart),
  { ssr: false, loading: () => <div className="h-[150px] bg-gray-100 dark:bg-slate-700/50 rounded-xl animate-pulse" /> }
)
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false })
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false })
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false })
const LineChartComponent = dynamic(
  () => import('recharts').then(mod => mod.LineChart),
  { ssr: false, loading: () => <div className="h-[150px] bg-gray-100 dark:bg-slate-700/50 rounded-xl animate-pulse" /> }
)
const Line = dynamic(() => import('recharts').then(mod => mod.Line), { ssr: false })

// ============================================================
// SKELETON LOADER
// ============================================================
const ReportsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-[200px] bg-gray-100 dark:bg-slate-700/50 rounded-xl" />
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-[150px] bg-gray-100 dark:bg-slate-700/50 rounded-xl" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-[150px] bg-gray-100 dark:bg-slate-700/50 rounded-xl" />
      </div>
    </div>
  </div>
)

export default function ReportsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [period, setPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('3m')
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      loadData().finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [loading, refreshing])

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    const endDate = new Date()
    const startDate = subMonths(endDate, parseInt(period))

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', format(startDate, 'yyyy-MM-dd'))
      .lte('date', format(endDate, 'yyyy-MM-dd'))
      .order('date', { ascending: true })

    setTransactions(Array.isArray(data) ? data : [])
    setLoading(false)
    setLoadingPulse(false)
  }, [user, context, period])

  useEffect(() => { loadData() }, [loadData])

  // ============================================================
  // PROCESSAMENTO DOS DADOS
  // ============================================================
  const filteredTransactions = filterType === 'all' 
    ? transactions 
    : transactions.filter(t => t.type === filterType)

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount), 0)

  const balance = totalIncome - totalExpense

  const categoryData = filteredTransactions.reduce((acc: any[], t) => {
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

  const monthlyData = transactions.reduce((acc: any[], t) => {
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
    const endDate = new Date()
    const startDate = subMonths(endDate, 1)
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd')
      const dayTransactions = transactions.filter(t => t.date === dayStr)
      const income = dayTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount), 0)
      const expense = dayTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount), 0)
      return {
        date: format(day, 'dd/MM'),
        income,
        expense,
        balance: income - expense,
      }
    })
  })()

  const handleExport = (format: 'pdf' | 'csv') => {
    alert(`Exportando relatório em ${format.toUpperCase()}`)
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
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 size={20} className="text-teal-500" />
            Relatórios
          </h1>
          <button
            onClick={loadData}
            className="p-2 text-gray-400 hover:text-teal-600 transition-colors"
          >
            <RefreshCw size={20} className={loadingPulse ? 'animate-spin' : ''} />
          </button>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm border border-gray-50 dark:border-slate-700">
            {periods.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key as any)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                  period === p.key
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm border border-gray-50 dark:border-slate-700">
            {filterOptions.map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key as any)}
                className={`px-2 py-1.5 rounded-full text-[10px] font-bold transition-all ${
                  filterType === f.key
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <ReportsSkeleton />
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <BarChart3 size={40} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum dado disponível</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
              Não há transações no período selecionado.
            </p>
            <button
              onClick={loadData}
              className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors"
            >
              Recarregar
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                  <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-1">Receitas</p>
                <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-2">
                  <TrendingDown size={16} className="text-red-500" />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-1">Despesas</p>
                <p className="text-[15px] font-bold text-red-500">{formatCurrency(totalExpense)}</p>
              </div>
              <div className={`bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border text-center ${
                balance >= 0 
                  ? 'border-emerald-200 dark:border-emerald-800' 
                  : 'border-red-200 dark:border-red-800'
              }`}>
                <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
                  <Wallet size={16} className="text-teal-600 dark:text-teal-400" />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-1">Saldo</p>
                <p className={`text-[15px] font-bold ${balance >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
                  {formatCurrency(balance)}
                </p>
              </div>
            </div>

            {monthlyData.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                  <BarChart3 size={16} className="text-gray-400" />
                  Evolução Mensal
                </h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChartComponent data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                      <Tooltip
                        formatter={(v: any) => formatCurrency(v)}
                        contentStyle={{ fontSize: 12, borderRadius: 12 }}
                      />
                      <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChartComponent>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {categoryData.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
                  <h3 className="font-bold text-[11px] text-gray-800 dark:text-gray-200 mb-3 text-center">Categorias</h3>
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChartComponent>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={60}
                          paddingAngle={2}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any) => formatCurrency(v)}
                          contentStyle={{ fontSize: 10, borderRadius: 12 }}
                        />
                      </PieChartComponent>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {dailyData.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
                  <h3 className="font-bold text-[11px] text-gray-800 dark:text-gray-200 mb-3 text-center">Saldo Diário</h3>
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChartComponent data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fontSize: 8 }} interval={4} />
                        <YAxis tick={{ fontSize: 8 }} tickFormatter={(v) => `R$${v}`} />
                        <Tooltip
                          formatter={(v: any) => formatCurrency(v)}
                          contentStyle={{ fontSize: 10, borderRadius: 12 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="balance"
                          stroke="#14b8a6"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChartComponent>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleExport('pdf')}
                className="flex-1 bg-teal-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-teal-800 transition-colors flex items-center justify-center gap-2"
              >
                <FileText size={16} />
                PDF
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex-1 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-bold text-sm hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
              >
                <FileSpreadsheet size={16} />
                CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}