'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ContextProvider } from '@/components/ContextToggle'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Bot, MessageSquare, FileText, Settings,
  TrendingUp, TrendingDown, Wallet, Calendar, RefreshCw,
  Sparkles, Clock, AlertCircle, CheckCircle, Loader2,
  ArrowRight, Zap, Brain, BarChart3, PieChart, LineChart
} from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { formatCurrency } from '@/lib/utils'
import { useLocalData } from '@/hooks/useLocalData'

// ============================================================
// SKELETON LOADER
// ============================================================
const AssistantSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-56 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
          <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded mx-auto" />
          <div className="h-3 w-16 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto mt-1" />
        </div>
      ))}
    </div>
  </div>
)

function AssistantContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0,
    categoriesCount: 0,
    monthlyAverage: 0,
    lastMonthChange: 0,
    biggestCategory: '',
    biggestCategoryAmount: 0
  })
  const [quickStats, setQuickStats] = useState([
    { label: 'Receitas', value: 'R$ 0', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Despesas', value: 'R$ 0', icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/30' },
    { label: 'Transações', value: '0', icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Categorias', value: '0', icon: PieChart, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/30' },
  ])

  // ============================================================
  // 🔥 CORRIGIDO: Removidos realtime: true e realtime: false
  // ============================================================
  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context },
  })

  const { data: localCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context },
  })

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
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

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadData = async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      await Promise.all([reloadTransactions(), reloadCategories()])

      const txs = localTransactions || []
      const cats = localCategories || []

      // Cálculos
      const income = txs
        .filter((t: any) => t.type === 'income' && t.status === 'done')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

      const expense = txs
        .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

      // Categoria com maior gasto
      const categoryExpense: Record<string, number> = {}
      txs
        .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
        .forEach((t: any) => {
          const catId = t.category_id || 'uncategorized'
          categoryExpense[catId] = (categoryExpense[catId] || 0) + (Number(t.amount) || 0)
        })

      let biggestCategory = ''
      let biggestCategoryAmount = 0
      for (const [catId, amount] of Object.entries(categoryExpense)) {
        if (amount > biggestCategoryAmount) {
          biggestCategoryAmount = amount
          const cat = cats.find((c: any) => c.id === catId) as any
          biggestCategory = cat?.name || 'Sem categoria'
        }
      }

      // Média mensal (últimos 3 meses)
      const now = new Date()
      const threeMonthsAgo = subMonths(now, 3)
      const recentTxs = txs.filter((t: any) => new Date(t.date) >= threeMonthsAgo && t.status === 'done')
      const monthlyIncome = recentTxs
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
      const monthlyExpense = recentTxs
        .filter((t: any) => (t.type === 'expense' || t.type === 'sangria'))
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
      const monthlyAverage = (monthlyIncome - monthlyExpense) / 3

      // Variação do último mês
      const lastMonth = subMonths(now, 1)
      const thisMonthTxs = txs.filter((t: any) => 
        new Date(t.date) >= new Date(now.getFullYear(), now.getMonth(), 1) && t.status === 'done'
      )
      const lastMonthTxs = txs.filter((t: any) => 
        new Date(t.date) >= new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1) &&
        new Date(t.date) < new Date(now.getFullYear(), now.getMonth(), 1) &&
        t.status === 'done'
      )

      const thisMonthIncome = thisMonthTxs
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
      const thisMonthExpense = thisMonthTxs
        .filter((t: any) => (t.type === 'expense' || t.type === 'sangria'))
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
      const lastMonthIncome = lastMonthTxs
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
      const lastMonthExpense = lastMonthTxs
        .filter((t: any) => (t.type === 'expense' || t.type === 'sangria'))
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

      const thisMonthBalance = thisMonthIncome - thisMonthExpense
      const lastMonthBalance = lastMonthIncome - lastMonthExpense
      const lastMonthChange = lastMonthBalance !== 0 
        ? ((thisMonthBalance - lastMonthBalance) / Math.abs(lastMonthBalance)) * 100 
        : 0

      setStats({
        totalIncome: income,
        totalExpense: expense,
        balance: income - expense,
        transactionCount: txs.length,
        categoriesCount: cats.length,
        monthlyAverage,
        lastMonthChange,
        biggestCategory,
        biggestCategoryAmount
      })

      setQuickStats([
        { label: 'Receitas', value: formatCurrency(income), icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
        { label: 'Despesas', value: formatCurrency(expense), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/30' },
        { label: 'Transações', value: `${txs.length}`, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
        { label: 'Categorias', value: `${cats.length}`, icon: PieChart, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/30' },
      ])
    } catch (err) {
      console.error('Erro ao carregar dados do assistente:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id, context])

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
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

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Bot size={24} className="text-teal-600" />
          Assistente IA
        </h2>
        <button
          onClick={() => router.push('/assistant/settings')}
          className="p-2 -mr-2 text-gray-400 hover:text-teal-600 transition-colors"
        >
          <Settings size={22} />
        </button>
      </div>

      <div className="mb-4">
        <ContextToggle />
      </div>

      {loading ? (
        <AssistantSkeleton />
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-[24px] p-5 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles size={24} className="text-teal-200" />
              <h3 className="font-bold text-lg">Resumo Financeiro</h3>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-teal-100 text-sm">Saldo total</p>
                <p className="text-3xl font-bold">{formatCurrency(stats.balance)}</p>
              </div>
              <div className="text-right">
                <p className="text-teal-100 text-sm">Variação mensal</p>
                <p className={`text-xl font-bold ${stats.lastMonthChange >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {stats.lastMonthChange >= 0 ? '+' : ''}{stats.lastMonthChange.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {quickStats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <div key={index} className={`${stat.bg} rounded-[20px] p-4 border border-transparent`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={18} className={stat.color} />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</span>
                  </div>
                  <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              )
            })}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Brain size={18} className="text-teal-600" />
              Insights rápidos
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <Wallet size={16} className="text-teal-700 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Média mensal</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(stats.monthlyAverage)}</p>
                </div>
              </div>
              {stats.biggestCategory && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <PieChart size={16} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Maior gasto</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{stats.biggestCategory} • {formatCurrency(stats.biggestCategoryAmount)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <BarChart3 size={16} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Total de transações</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stats.transactionCount} registros</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => router.push('/assistant/chat')}
              className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 hover:shadow-md transition-all active:scale-[0.98] flex flex-col items-center gap-2"
            >
              <MessageSquare size={24} className="text-teal-600" />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Chat IA</span>
              <span className="text-[10px] text-gray-400 text-center">Converse com o assistente</span>
            </button>
            <button
              onClick={() => router.push('/assistant/report')}
              className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 hover:shadow-md transition-all active:scale-[0.98] flex flex-col items-center gap-2"
            >
              <FileText size={24} className="text-teal-600" />
              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Relatório IA</span>
              <span className="text-[10px] text-gray-400 text-center">Análise detalhada</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AssistantPage() {
  return (
    <ContextProvider>
      <AssistantContent />
    </ContextProvider>
  )
}