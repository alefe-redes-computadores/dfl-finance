'use client'

import { useEffect, useState, useRef } from 'react'
import { ContextProvider } from '@/components/ContextToggle'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Bot, MessageSquare, FileText, Settings,
  TrendingUp, TrendingDown, Wallet, Calendar, RefreshCw,
  Sparkles, AlertCircle, CheckCircle,
  BarChart3, PieChart, Brain, X
} from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { formatCurrency } from '@/lib/utils'
import { useLocalData } from '@/hooks/useLocalData'

// 🔥 SKELETON ATUALIZADO
const AssistantSkeleton = () => (
  <div className="space-y-4 animate-pulse pt-2">
    <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-center gap-4">
        <div className="w-[52px] h-[52px] rounded-[18px] bg-gray-200 dark:bg-slate-700 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-48 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4">
          <div className="w-9 h-9 rounded-[14px] bg-gray-200 dark:bg-slate-700 mb-3" />
          <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
          <div className="h-3 w-16 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      ))}
    </div>
  </div>
)

function AssistantContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const [showSettings, setShowSettings] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [settingsMessage, setSettingsMessage] = useState({ type: '', text: '' })

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
    { label: 'Receitas', value: 'R$ 0', icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    { label: 'Despesas', value: 'R$ 0', icon: TrendingDown, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' },
    { label: 'Transações', value: '0', icon: Calendar, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
    { label: 'Categorias', value: '0', icon: PieChart, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30' },
  ])

  // 🔥 HOOKS CORRIGIDOS (Adicionado o parâmetro 'loading')
  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context },
  })

  const { data: localCategories, loading: catLoading, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context },
  })

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key')
    if (savedKey) setApiKey(savedKey)
  }, [])

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      setSettingsMessage({ type: 'error', text: 'A chave não pode estar vazia.' })
      return
    }
    localStorage.setItem('gemini_api_key', apiKey)
    setSettingsMessage({ type: 'success', text: 'Chave salva com sucesso!' })
    setTimeout(() => {
      setShowSettings(false)
      setSettingsMessage({ type: '', text: '' })
    }, 2000)
  }

  // Lógica do Pull to Refresh
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
      Promise.all([reloadTransactions(), reloadCategories()]).finally(() => setRefreshing(false))
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

  // 🔥 O SEGREDO DO LOOP RESOLVIDO: O cálculo reage aos dados automaticamente
  useEffect(() => {
    if (txLoading || catLoading) {
      setLoading(true)
      setLoadingPulse(true)
      return
    }

    const txs = localTransactions || []
    const cats = localCategories || []

    const income = txs
      .filter((t: any) => t.type === 'income' && t.status === 'done')
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

    const expense = txs
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
      .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

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

    const now = new Date()
    const threeMonthsAgo = subMonths(now, 3)
    const recentTxs = txs.filter((t: any) => new Date(t.date) >= threeMonthsAgo && t.status === 'done')
    const monthlyIncome = recentTxs.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
    const monthlyExpense = recentTxs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria')).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
    const monthlyAverage = (monthlyIncome - monthlyExpense) / 3

    const lastMonth = subMonths(now, 1)
    const thisMonthTxs = txs.filter((t: any) => new Date(t.date) >= new Date(now.getFullYear(), now.getMonth(), 1) && t.status === 'done')
    const lastMonthTxs = txs.filter((t: any) => 
      new Date(t.date) >= new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1) &&
      new Date(t.date) < new Date(now.getFullYear(), now.getMonth(), 1) &&
      t.status === 'done'
    )

    const thisMonthIncome = thisMonthTxs.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
    const thisMonthExpense = thisMonthTxs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria')).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
    const lastMonthIncome = lastMonthTxs.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
    const lastMonthExpense = lastMonthTxs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria')).reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)

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
      { label: 'Receitas', value: formatCurrency(income), icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
      { label: 'Despesas', value: formatCurrency(expense), icon: TrendingDown, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' },
      { label: 'Transações', value: `${txs.length}`, icon: Calendar, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/30' },
      { label: 'Categorias', value: `${cats.length}`, icon: PieChart, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-900/30' },
    ])

    setLoading(false)
    setLoadingPulse(false)
  }, [localTransactions, localCategories, txLoading, catLoading])

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans relative transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-6 right-6 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* 🔥 HEADER UNIFICADO */}
      <div className="sticky top-0 z-40 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => router.push('/more')}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                  Assistente IA
                  <Bot size={20} className="text-teal-500 shrink-0" />
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {appMode === "personal_only" ? "Visão pessoal" : "Visão global"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="h-11 w-11 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.98] shrink-0"
            >
              <Settings size={18} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>
          </div>
        </div>
      </div>

      {/* 🔥 MODAL SETTINGS */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 animate-in slide-in-from-bottom-full duration-300 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[16px] bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Settings size={18} />
                </div>
                <h3 className="font-semibold text-[18px] text-gray-800 dark:text-gray-100">Configuração IA</h3>
              </div>

              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1 block">
                  Chave da API Gemini
                </label>
                <input
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  type="password"
                  placeholder="Cole sua chave aqui (AIzaSy...)"
                  className="w-full rounded-[16px] bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-4 py-3 text-[14px] text-gray-800 dark:text-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                />
              </div>

              {settingsMessage.text && (
                <div className={`flex items-center gap-2 rounded-[16px] px-4 py-3 text-[13px] font-semibold ${
                  settingsMessage.type === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
                    : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {settingsMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                  <span>{settingsMessage.text}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveApiKey}
                className="w-full bg-teal-600 text-white py-4 rounded-[20px] font-bold text-[15px] shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-[0.98] transition-all mt-2"
              >
                Salvar Chave
              </button>

              <div className="pt-2 text-center">
                <p className="text-[12px] text-gray-500 dark:text-gray-400">
                  Obtenha sua chave gratuitamente no <br />
                  <a
                    href="https://aistudio.google.com/app/apikeys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-600 dark:text-teal-400 hover:underline font-semibold"
                  >
                    Google AI Studio
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-3 space-y-4">
        {loading ? (
          <AssistantSkeleton />
        ) : (
          <div className="space-y-4 animate-in fade-in duration-500">
            {/* 🔥 CARD BASE DE CONHECIMENTO */}
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1">
                    Base de conhecimento IA
                  </p>
                  <p className="text-[30px] leading-none font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                    {formatCurrency(stats.balance)}
                  </p>
                  <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-2">
                    Saldo histórico consolidado
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="w-12 h-12 rounded-[18px] bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center ml-auto mb-2">
                    <Sparkles size={20} className="text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                    Evolução
                  </p>
                  <p className={`text-[14px] font-bold ${stats.lastMonthChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                    {stats.lastMonthChange >= 0 ? '+' : ''}{stats.lastMonthChange.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            {/* 🔥 QUICK STATS */}
            <div className="grid grid-cols-2 gap-3">
              {quickStats.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div
                    key={index}
                    className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-4"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-9 h-9 rounded-[14px] flex items-center justify-center ${stat.bg}`}>
                        <Icon size={17} className={stat.color} />
                      </div>
                      <span className="text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                        {stat.label}
                      </span>
                    </div>
                    <p className="text-[18px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                      {stat.value}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* 🔥 DESTAQUES */}
            <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5">
              <h3 className="font-semibold text-[16px] text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Brain size={18} className="text-indigo-500" />
                Destaques para a IA
              </h3>

              <div className="space-y-2">
                <div className="rounded-[18px] p-3 bg-gray-50/80 dark:bg-slate-900/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center shrink-0">
                      <Wallet size={18} className="text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                        Média mensal (trimestre)
                      </p>
                      <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatCurrency(stats.monthlyAverage)}
                      </p>
                    </div>
                  </div>
                </div>

                {stats.biggestCategory && (
                  <div className="rounded-[18px] p-3 bg-gray-50/80 dark:bg-slate-900/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[14px] bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                        <PieChart size={18} className="text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                          Principal gasto histórico
                        </p>
                        <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                          {stats.biggestCategory} • {formatCurrency(stats.biggestCategoryAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-[18px] p-3 bg-gray-50/80 dark:bg-slate-900/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                      <BarChart3 size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                        Volume de dados lidos
                      </p>
                      <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                        {stats.transactionCount} registros processados
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 🔥 AÇÕES */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => router.push('/assistant/chat')}
                className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-[18px] bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center">
                  <MessageSquare size={24} className="text-teal-600 dark:text-teal-400" />
                </div>
                <div className="text-center">
                  <span className="block text-[15px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                    Chat Inteligente
                  </span>
                  <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Tire dúvidas financeiras
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => router.push('/assistant/report')}
                className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-[18px] bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                  <FileText size={24} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-center">
                  <span className="block text-[15px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                    Relatório DFL
                  </span>
                  <span className="block text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    Análise escrita por IA
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
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
