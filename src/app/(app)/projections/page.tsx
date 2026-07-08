'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, RefreshCw, TrendingUp, TrendingDown, Wallet,
  Calendar, BarChart3, LineChart, AlertCircle, Info
} from 'lucide-react'
import { format, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { formatCurrency } from '@/lib/utils'
import { useLocalData } from '@/hooks/useLocalData'
// 🔥 NOVO: Importando o useSafeDb para blindagem
import { useSafeDb } from '@/hooks/useSafeDb'

// ✅ Imports normais (sem lazy loading)
import {
  AreaChart,
  Area,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

// ============================================================
// SKELETON LOADER
// ============================================================
const ProjectionsSkeleton = () => (
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
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="flex gap-2">
          <div className="h-8 w-16 bg-gray-200 dark:bg-slate-700 rounded-full" />
          <div className="h-8 w-16 bg-gray-200 dark:bg-slate-700 rounded-full" />
          <div className="h-8 w-16 bg-gray-200 dark:bg-slate-700 rounded-full" />
        </div>
      </div>
      <div className="h-[220px] bg-gray-100 dark:bg-slate-700/50 rounded-xl" />
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between p-2 border-b border-gray-50 dark:border-slate-700 last:border-0">
          <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
          <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  </div>
)

export default function ProjectionsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context, effectiveContext } = useContext_()
  // 🔥 NOVO: Hook de blindagem (preparatório)
  const { safeDelete, safeUpdate, safeAdd } = useSafeDb()
  
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [projections, setProjections] = useState<any[]>([])
  const [period, setPeriod] = useState<'3m' | '6m' | '12m'>('6m')
  const [scenario, setScenario] = useState<'optimistic' | 'realistic' | 'pessimistic'>('realistic')

  // ============================================================
  // 🔥 CORRIGIDO: Usa effectiveContext
  // ============================================================
  const { data: localTransactions, loading: txLoading, syncing: txSyncing, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

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

  // ============================================================
  // EFEITO PARA PROCESSAR DADOS SEMPRE QUE LOCALTRANSACTIONS MUDAR
  // ============================================================
  useEffect(() => {
    if (!localTransactions || localTransactions.length === 0) {
      setProjections([])
      setLoading(false)
      setLoadingPulse(false)
      return
    }

    const endDate = new Date()
    const startDate = subMonths(endDate, 6)

    // 🔥 FILTRA TRANSAÇÕES PELO PERÍODO (últimos 6 meses)
    const filtered = localTransactions.filter((tx: any) => {
      const txDate = new Date(tx.date)
      return txDate >= startDate && txDate <= endDate
    })

    if (filtered.length === 0) {
      setProjections([])
      setLoading(false)
      setLoadingPulse(false)
      return
    }

    // 🔥 AGRUPAMENTO POR MÊS
    const months = new Map()
    filtered.forEach((tx: any) => {
      const month = format(new Date(tx.date), 'yyyy-MM')
      if (!months.has(month)) {
        months.set(month, { income: 0, expense: 0 })
      }
      const data = months.get(month)
      if (tx.type === 'income') {
        data.income += Number(tx.amount)
      } else {
        data.expense += Number(tx.amount)
      }
    })

    let totalIncome = 0
    let totalExpense = 0
    months.forEach((data) => {
      totalIncome += data.income
      totalExpense += data.expense
    })

    const avgIncome = totalIncome / months.size
    const avgExpense = totalExpense / months.size

    // 🔥 SALDO ATUAL (CÁLCULO CUMULATIVO)
    let currentBalance = 0
    filtered.forEach((tx: any) => {
      currentBalance += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)
    })

    // 🔥 PROJEÇÃO
    const monthsToProject = parseInt(period)
    const projectionData = []
    let balance = currentBalance

    for (let i = 0; i <= monthsToProject; i++) {
      const date = addMonths(new Date(), i)
      const monthKey = format(date, 'yyyy-MM')
      const monthLabel = format(date, "MMM 'yy", { locale: ptBR })

      let income = avgIncome
      let expense = avgExpense

      if (scenario === 'optimistic') {
        income *= 1.1
        expense *= 0.9
      } else if (scenario === 'pessimistic') {
        income *= 0.9
        expense *= 1.1
      }

      balance += income - expense

      projectionData.push({
        month: monthKey,
        label: monthLabel,
        income: income,
        expense: expense,
        balance: balance,
        currentBalance: i === 0 ? currentBalance : undefined,
      })
    }

    setProjections(projectionData)
    setLoading(false)
    setLoadingPulse(false)
  }, [localTransactions, period, scenario])

  // ============================================================
  // CARREGA DADOS INICIALMENTE
  // ============================================================
  useEffect(() => {
    if (user?.id && context) {
      loadData()
    }
  }, [user?.id, context, loadData])

  // ============================================================
  // CONFIGURAÇÕES DE UI
  // ============================================================
  const periods = [
    { key: '3m', label: '3 meses' },
    { key: '6m', label: '6 meses' },
    { key: '12m', label: '12 meses' },
  ]

  const scenarios = [
    { key: 'optimistic', label: 'Otimista', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' },
    { key: 'realistic', label: 'Realista', icon: BarChart3, color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400' },
    { key: 'pessimistic', label: 'Pessimista', icon: TrendingDown, color: 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400' },
  ]

  const currentData = projections[0] || { balance: 0 }
  const futureData = projections[projections.length - 1] || { balance: 0 }
  const variation = currentData.balance !== 0 
    ? ((futureData.balance - currentData.balance) / Math.abs(currentData.balance)) * 100 
    : 0

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
            <LineChart size={20} className="text-teal-500" />
            Projeções
          </h1>
          <button            onClick={loadData}
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
            {scenarios.map(s => {
              const Icon = s.icon
              const isActive = scenario === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => setScenario(s.key as any)}
                  className={`px-2 py-1.5 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${
                    isActive
                      ? s.color
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon size={12} />
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <ProjectionsSkeleton />
        ) : projections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <LineChart size={40} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Dados insuficientes</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[280px]">
              Precisamos de mais transações para fazer uma projeção precisa. Continue registrando suas movimentações.
            </p>
            <button
              onClick={() => router.push('/transactions/new')}
              className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors"
            >
              Adicionar transação
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
                <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
                  <Wallet size={16} className="text-teal-600 dark:text-teal-400" />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-1">Saldo atual</p>
                <p className={`text-[15px] font-bold ${currentData.balance >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
                  {formatCurrency(currentData.balance)}
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                  <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-1">Projetado</p>
                <p className={`text-[15px] font-bold ${futureData.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatCurrency(futureData.balance)}
                </p>
              </div>
              <div className={`bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border text-center ${
                variation >= 0 
                  ? 'border-emerald-200 dark:border-emerald-800' 
                  : 'border-red-200 dark:border-red-800'
              }`}>
                <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-2">
                  <BarChart3 size={16} className="text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold mb-1">Variação</p>
                <p className={`text-[15px] font-bold ${variation >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {variation >= 0 ? '+' : ''}{variation.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <LineChart size={16} className="text-gray-400" />
                  Evolução do Saldo
                </h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-teal-500" />
                    <span className="text-[10px] text-gray-400">Projetado</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-gray-400">Atual</span>
                  </div>
                </div>
              </div>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projections}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${v}`} />
                    <Tooltip
                      formatter={(v: any) => formatCurrency(v)}
                      contentStyle={{ fontSize: 12, borderRadius: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      fill="url(#balanceGradient)"
                    />
                    <Line
                      type="monotone"
                      dataKey="currentBalance"
                      stroke="#34d399"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <Calendar size={16} className="text-gray-400" />
                  Projeção mensal
                </h3>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <Info size={12} />
                  Cenário {scenarios.find(s => s.key === scenario)?.label}
                </div>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {projections.map((item, index) => (
                  <div
                    key={item.month}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      index === 0 ? 'bg-teal-50 dark:bg-teal-900/20' : ''
                    } ${index === projections.length - 1 ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}
                  >
                    <span className="text-[12px] font-bold text-gray-700 dark:text-gray-300">
                      {item.label}
                      {index === 0 && ' (atual)'}
                      {index === projections.length - 1 && ' (projetado)'}
                    </span>
                    <span className="text-[12px] text-gray-500 dark:text-gray-400">
                      {formatCurrency(item.income)} / {formatCurrency(item.expense)}
                    </span>
                    <span className={`text-[13px] font-bold ${item.balance >= 0 ? 'text-teal-600' : 'text-red-500'}`}>
                      {formatCurrency(item.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}