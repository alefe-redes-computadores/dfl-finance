
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowUp,
  ArrowDown,
  Wallet,
  Tag,
  SlidersHorizontal,
  X,
  Download,
  FileText,
  RefreshCw,
  Filter,
} from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  AreaChart,
  Area,
} from 'recharts'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import DetailedProjectionChart from '@/components/DetailedProjectionChart'
import { useLocalData } from '@/hooks/useLocalData'

const AnalysisSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="h-3 w-14 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
      ))}
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      <div className="flex justify-center">
        <div className="w-44 h-44 rounded-full bg-gray-100 dark:bg-slate-700" />
      </div>
      <div className="flex justify-center gap-3 mt-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-slate-700" />
            <div className="h-3 w-12 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        ))}
      </div>
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-36 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-48 bg-gray-100 dark:bg-slate-700/50 rounded-lg" />
    </div>
  </div>
)

function AnalysisContent() {
  const { user } = useAuth()
  const { context } = useContext_()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [previousSummary, setPreviousSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [byCategory, setByCategory] = useState<any[]>([])
  const [monthlyFlow, setMonthlyFlow] = useState<any[]>([])
  const [patrimony, setPatrimony] = useState<any[]>([])
  const [patrimonyGrowth, setPatrimonyGrowth] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'month' | 'new'>('month')
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [newGastos, setNewGastos] = useState<any[]>([])
  const [newGastosSummary, setNewGastosSummary] = useState({
    total: 0,
    count: 0,
    average: 0,
    maiorPeso: { name: '', percent: '0' },
  })

  const [filterAccount, setFilterAccount] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const hasActiveFilters = filterAccount || filterCategory

  const { data: localTransactions } = useLocalData({ table: 'transactions', filters: { context }, orderBy: { field: 'date', direction: 'desc' }, realtime: true })
  const { data: localCategories } = useLocalData({ table: 'categories', filters: { context }, realtime: false })
  const { data: localAccounts } = useLocalData({ table: 'accounts', filters: { context }, realtime: false })

  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      const transactionsWithJoin = (localTransactions || []).map((tx: any) => {
        const category = (localCategories || []).find((c: any) => c.id === tx.category_id) as any
        const account = (localAccounts || []).find((a: any) => a.id === tx.account_id) as any
        return {
          ...tx,
          categories: category ? { name: category.name, icon: category.icon, color: category.color } : null,
          accounts: account ? { name: account.name, color: account.color } : null,
        }
      })

      const start12 = format(startOfMonth(subMonths(currentDate, 11)), 'yyyy-MM-dd')
      const endNow = format(endOfMonth(currentDate), 'yyyy-MM-dd')
      const txs = transactionsWithJoin.filter((t: any) => t.date >= start12 && t.date <= endNow)

      const currentStart = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const currentEnd = format(endOfMonth(currentDate), 'yyyy-MM-dd')
      let currentTxs = txs.filter((t: any) => t.date >= currentStart && t.date <= currentEnd)

      if (filterAccount) currentTxs = currentTxs.filter((t: any) => t.account_id === filterAccount)
      if (filterCategory) currentTxs = currentTxs.filter((t: any) => t.category_id === filterCategory)

      const income = currentTxs.filter((t: any) => t.type === 'income' && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      const expense = currentTxs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      setSummary({ income, expense, balance: income - expense })

      const prevStart = format(startOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
      const prevEnd = format(endOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
      const prevTxs = txs.filter((t: any) => t.date >= prevStart && t.date <= prevEnd)
      const prevIncome = prevTxs.filter((t: any) => t.type === 'income' && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      const prevExpense = prevTxs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      setPreviousSummary({ income: prevIncome, expense: prevExpense, balance: prevIncome - prevExpense })

      const catMap: Record<string, { name: string; color: string; icon: string; total: number }> = {}
      currentTxs.filter((t: any) => t.type === 'expense' || t.type === 'sangria').forEach((t: any) => {
        const key = t.category_id ?? 'sem'
        if (!catMap[key]) {
          catMap[key] = { name: t.categories?.name ?? 'Sem categoria', color: t.categories?.color ?? '#64748b', icon: t.categories?.icon ?? 'other', total: 0 }
        }
        catMap[key].total += Number(t.amount || 0)
      })

      const categoriesArray = Object.values(catMap).map((cat) => ({ ...cat, percent: expense > 0 ? (cat.total / expense) * 100 : 0 })).sort((a, b) => b.total - a.total)
      setByCategory(categoriesArray)

      const flowData: any[] = []
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(currentDate, i)
        const s = format(startOfMonth(d), 'yyyy-MM-dd')
        const e = format(endOfMonth(d), 'yyyy-MM-dd')
        const monthTxs = txs.filter((t: any) => t.date >= s && t.date <= e)
        const inc = monthTxs.filter((t: any) => t.type === 'income' && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
        const exp = monthTxs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
        flowData.push({ name: format(d, 'MMM', { locale: ptBR }).toUpperCase(), Receitas: inc, Despesas: exp })
      }
      setMonthlyFlow(flowData)

      const currentBalance = (localAccounts || []).reduce((a: number, c: any) => a + (Number(c.balance) || 0), 0)

      const patrimData: any[] = []
      let cumulative = 0
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(currentDate, i)
        const s = format(startOfMonth(d), 'yyyy-MM-dd')
        const e = format(endOfMonth(d), 'yyyy-MM-dd')
        const monthTxs = txs.filter((t: any) => t.date >= s && t.date <= e)
        const inc = monthTxs.filter((t: any) => t.type === 'income' && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
        const exp = monthTxs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
        cumulative += inc - exp
        patrimData.push({ name: format(d, 'MMM', { locale: ptBR }).toUpperCase(), Patrimônio: currentBalance + cumulative })
      }
      setPatrimony(patrimData)

      const first = patrimData[0]?.Patrimônio || 0
      const last = patrimData[patrimData.length - 1]?.Patrimônio || 0
      setPatrimonyGrowth(first > 0 ? ((last - first) / first) * 100 : 0)

      const prevCatIds = new Set(prevTxs.map((t: any) => t.category_id).filter(Boolean))
      const newOnes = currentTxs.filter((t: any) => t.category_id && !prevCatIds.has(t.category_id))

      const newCatMap: Record<string, { name: string; color: string; icon: string; total: number }> = {}
      newOnes.forEach((t: any) => {
        const key = t.category_id ?? 'sem'
        if (!newCatMap[key]) {
          newCatMap[key] = { name: t.categories?.name ?? 'Sem categoria', color: t.categories?.color ?? '#64748b', icon: t.categories?.icon ?? 'other', total: 0 }
        }
        newCatMap[key].total += Number(t.amount || 0)
      })

      const newCatArray = Object.values(newCatMap).map(cat => ({ ...cat, percent: expense > 0 ? (cat.total / expense) * 100 : 0 })).sort((a, b) => b.total - a.total)
      setNewGastos(newCatArray)

      const newTotal = newCatArray.reduce((a, c) => a + c.total, 0)
      const newCount = newCatArray.length
      const newAverage = newCount > 0 ? newTotal / newCount : 0
      const maiorPesoName = newCatArray.length > 0 ? newCatArray[0].name : '-'
      const maiorPesoPercent = newCatArray.length > 0 && newTotal > 0 ? ((newCatArray[0].total / newTotal) * 100).toFixed(0) : '0'
      setNewGastosSummary({ total: newTotal, count: newCount, average: newAverage, maiorPeso: { name: maiorPesoName, percent: maiorPesoPercent } })

      setLoading(false)
      setLoadingPulse(false)
    } catch (err) {
      console.error('Erro ao carregar análise:', err)
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [user?.id, context, currentDate, filterAccount, filterCategory, localTransactions, localCategories, localAccounts])

  useEffect(() => {
    if (user?.id && context) {
      loadData()
    }
  }, [user?.id, context, currentDate, filterAccount, filterCategory, loadData])

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

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const calcVariation = (current: number, previous: number) => { if (previous === 0) return current > 0 ? 100 : current < 0 ? -100 : 0; return ((current - previous) / Math.abs(previous)) * 100 }
  const incomeVariation = calcVariation(summary.income, previousSummary.income)
  const expenseVariation = calcVariation(summary.expense, previousSummary.expense)
  const balanceVariation = calcVariation(summary.balance, previousSummary.balance)

  const handleExport = (range: string) => { setShowExportMenu(false); if (!user) return; window.open(`/api/export-analysis?userId=${user.id}&context=${context}&range=${range}`, '_blank') }
  const handleExportPDF = (range: string) => { setShowExportMenu(false); if (!user) return; window.open(`/api/export-pdf?userId=${user.id}&context=${context}&range=${range}`, '_blank') }
  const handleApplyFilters = () => { setShowFilterDrawer(false); loadData() }
  const handleClearFilters = () => { setFilterAccount(''); setFilterCategory(''); setShowFilterDrawer(false) }

  if (loading) return <AnalysisSkeleton />

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <ContextToggle />
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 px-3 py-1.5 rounded-full">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-1 text-gray-800 dark:text-gray-300 hover:text-gray-500 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-wide">
              {monthLabel}
            </span>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-1 text-gray-800 dark:text-gray-300 hover:text-gray-500 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-9 h-9 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 rounded-full flex items-center justify-center"
            >
              <Download size={18} className="text-gray-700 dark:text-gray-300" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-[42px] w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 p-2 z-30 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">
                  Exportar análise
                </p>
                {[
                  { key: '7', label: '7 dias' },
                  { key: '14', label: '14 dias' },
                  { key: '30', label: '30 dias' },
                  { key: 'total', label: 'Todo período' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handleExport(opt.key)}
                    className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    CSV {opt.label}
                  </button>
                ))}
                <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
                {[
                  { key: '7', label: '7 dias' },
                  { key: '14', label: '14 dias' },
                  { key: '30', label: '30 dias' },
                  { key: 'total', label: 'Todo período' },
                ].map((opt) => (
                  <button
                    key={`pdf-${opt.key}`}
                    onClick={() => handleExportPDF(opt.key)}
                    className="w-full text-left px-3 py-2 rounded-xl text-[13px] font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <FileText size={14} className="text-teal-600" />
                    PDF {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFilterDrawer(true)}
            className={`w-9 h-9 bg-white dark:bg-slate-800 shadow-sm border rounded-full flex items-center justify-center relative transition-colors ${
              hasActiveFilters
                ? 'border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400'
                : 'border-gray-50 dark:border-slate-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <SlidersHorizontal size={18} />
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full border-2 border-white dark:border-slate-800" />
            )}
          </button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex items-center gap-2 mb-4 px-1">
          <Filter size={14} className="text-teal-600 dark:text-teal-400" />
          <span className="text-xs font-medium text-teal-600 dark:text-teal-400">Filtros ativos</span>
          <button
            onClick={handleClearFilters}
            className="text-xs font-bold text-red-500 hover:text-red-600 ml-auto"
          >
            Limpar filtros
          </button>
        </div>
      )}

      <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Análise</h2>

      <div className="flex bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 p-1 rounded-full mb-6">
        <button
          onClick={() => setActiveTab('month')}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${
            activeTab === 'month'
              ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          No mês
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${
            activeTab === 'new'
              ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          Novos gastos
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-50 dark:border-slate-700">
              <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                <Sparkles size={20} className="text-teal-700 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-0.5">
                  Novos gastos do mês
                </p>
                <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {formatCurrency(newGastosSummary.total)}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mb-1">Categorias</p>
                <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{newGastosSummary.count}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mb-1">Média</p>
                <p className="text-[14px] font-bold text-red-400">{formatCurrency(newGastosSummary.average)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mb-1">Maior peso</p>
                <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate max-w-[100px]">
                  {newGastosSummary.maiorPeso.name}
                </p>
                <span className="text-[11px] text-red-400 font-bold">{newGastosSummary.maiorPeso.percent}%</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            {newGastos.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">
                Nenhum novo gasto neste mês.
              </p>
            ) : (
              <>
                <div className="h-48 relative flex items-center justify-center mb-6">
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                      Total
                    </p>
                    <p className="text-[18px] font-bold text-gray-800 dark:text-gray-100">
                      {formatCurrency(newGastosSummary.total)}
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={newGastos}
                        dataKey="total"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {newGastos.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-4">
                  {newGastos.map((c) => {
                    const IconComp = getDynamicIcon(c.icon)
                    return (
                      <div key={c.name}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: `${c.color}20`, color: c.color }}
                            >
                              <IconComp size={18} />
                            </div>
                            <span className="font-bold text-[13px] text-gray-800 dark:text-gray-200">{c.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[13px] text-gray-800 dark:text-gray-200">
                              {formatCurrency(c.total)}
                            </span>
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                              {c.percent.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${c.percent}%`, backgroundColor: c.color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                <ArrowUp size={16} className="text-emerald-600" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Receitas</p>
              <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(summary.income)}</p>
              {previousSummary.income > 0 && (
                <div
                  className={`inline-flex items-center gap-0.5 mt-1 text-[10px] font-bold ${
                    incomeVariation >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {incomeVariation >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {incomeVariation >= 0 ? '+' : ''}
                  {incomeVariation.toFixed(1)}%
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-2">
                <ArrowDown size={16} className="text-red-500" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Despesas</p>
              <p className="text-[15px] font-bold text-red-500">{formatCurrency(summary.expense)}</p>
              {previousSummary.expense > 0 && (
                <div
                  className={`inline-flex items-center gap-0.5 mt-1 text-[10px] font-bold ${
                    expenseVariation <= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {expenseVariation <= 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                  {expenseVariation > 0 ? '+' : ''}
                  {expenseVariation.toFixed(1)}%
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
                <Wallet size={16} className="text-teal-700 dark:text-teal-400" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Saldo</p>
              <p className={`text-[15px] font-bold ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatCurrency(summary.balance)}
              </p>
              {previousSummary.balance !== 0 && (
                <div
                  className={`inline-flex items-center gap-0.5 mt-1 text-[10px] font-bold ${
                    balanceVariation >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}
                >
                  {balanceVariation >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {balanceVariation >= 0 ? '+' : ''}
                  {balanceVariation.toFixed(1)}%
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">
              Distribuição de Gastos
            </h3>
            {byCategory.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">
                Nenhuma despesa neste mês.
              </p>
            ) : (
              <div className="h-56 relative flex items-center justify-center">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                    Total Gasto
                  </p>
                  <p className="text-[20px] font-bold text-gray-800 dark:text-gray-100">
                    {formatCurrency(summary.expense)}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {byCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">
              Gastos por Categoria
            </h3>
            {byCategory.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-4">
                Nenhuma despesa neste mês.
              </p>
            ) : (
              <div className="space-y-4">
                {byCategory.map((c) => {
                  const IconComp = getDynamicIcon(c.icon)
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{ backgroundColor: `${c.color}20`, color: c.color }}
                          >
                            <IconComp size={18} />
                          </div>
                          <span className="font-bold text-[13px] text-gray-800 dark:text-gray-200">{c.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-[13px] text-gray-800 dark:text-gray-200">
                            {formatCurrency(c.total)}
                          </span>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                            {c.percent.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${c.percent}%`, backgroundColor: c.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">
              Fluxo Mensal
            </h3>
            {monthlyFlow.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">
                Sem dados para exibir.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyFlow}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <ReTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100">Patrimônio</h3>
              <span
                className={`text-[14px] font-bold ${
                  patrimonyGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'
                }`}
              >
                {patrimonyGrowth >= 0 ? '+' : ''}
                {patrimonyGrowth.toFixed(1)}%
              </span>
            </div>
            {patrimony.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">
                Sem dados para exibir.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={patrimony}>
                  <defs>
                    <linearGradient id="colorPat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <ReTooltip formatter={(value: number) => formatCurrency(value)} />
                  <Area type="monotone" dataKey="Patrimônio" stroke="#14b8a6" fill="url(#colorPat)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <DetailedProjectionChart />
        </div>
      )}

      {showFilterDrawer && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50"
          onClick={() => setShowFilterDrawer(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Filtros</h3>
              <button
                onClick={() => setShowFilterDrawer(false)}
                className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 block">
                  Conta
                </label>
                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
                >
                  <option value="">Todas as contas</option>
                  {(localAccounts || []).map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 block">
                  Categoria
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
                >
                  <option value="">Todas as categorias</option>
                  {(localCategories || []).map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClearFilters}
                  className="flex-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-bold text-sm"
                >
                  Limpar
                </button>
                <button
                  onClick={handleApplyFilters}
                  className="flex-1 bg-teal-700 text-white py-3 rounded-xl font-bold text-sm"
                >
                  Aplicar Filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 🛡️ A CAPA PROTETORA
export default function AnalysisPage() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  
  if (!isClient) return <div className="min-h-screen bg-gray-50 dark:bg-slate-900" />
  
  return (
    <ContextProvider>
      <AnalysisContent />
    </ContextProvider>
  )
}
