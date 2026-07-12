'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ContextProvider } from '@/components/ContextToggle'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Bot, MessageSquare, FileText, Settings,
  TrendingUp, TrendingDown, Wallet, Calendar, RefreshCw,
  Sparkles, AlertCircle, CheckCircle,
  BarChart3, PieChart, Brain, X // 🔥 Imports corrigidos (Brain e X adicionados)
} from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { formatCurrency } from '@/lib/utils'
import { useLocalData } from '@/hooks/useLocalData'

// ============================================================
// SKELETON LOADER SOFT UI
// ============================================================
const AssistantSkeleton = () => (
  <div className="space-y-6 animate-pulse pt-2">
    <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-100 dark:border-slate-700/50">
      <div className="flex items-center gap-4">
        <div className="w-[52px] h-[52px] rounded-2xl bg-gray-200 dark:bg-slate-700 shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-48 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700/50">
          <div className="w-10 h-10 rounded-[14px] bg-gray-200 dark:bg-slate-700 mb-3" />
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
  
  // Estados para a Chave da API
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

  const { data: localTransactions, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context },
  })

  const { data: localCategories, reload: reloadCategories } = useLocalData({
    table: 'categories' as any,
    filters: { context },
  })

  // CARREGAR CHAVE DA API SALVA
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

  // PULL TO REFRESH
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

  // LOAD DATA
  const loadData = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      await Promise.all([reloadTransactions(), reloadCategories()])

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
      const monthlyIncome = recentTxs
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
      const monthlyExpense = recentTxs
        .filter((t: any) => (t.type === 'expense' || t.type === 'sangria'))
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
      const monthlyAverage = (monthlyIncome - monthlyExpense) / 3

      const lastMonth = subMonths(now, 1)
      const thisMonthTxs = txs.filter((t: any) => 
        new Date(t.date) >= new Date(now.getFullYear(), now.getMonth(), 1) && t.status === 'done'
      )
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
    } catch (err) {
      console.error('Erro ao carregar dados do assistente:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [user?.id, localTransactions, localCategories])

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id, context, loadData])

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans relative transition-colors duration-300">
      
      {/* Indicador de Sincronização Sutil */}
      {loadingPulse && (
        <div className="fixed top-6 right-6 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
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

      {/* HEADER SOFT UI */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl pt-6 pb-4 px-4 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border-b border-gray-100 dark:border-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => router.push('/more')} className="p-1 -ml-1 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
              <ChevronLeft size={24} />
            </button>
            <div>
              <h1 className="text-[24px] font-bold text-gray-900 dark:text-gray-100 tracking-tight flex items-center gap-2">
                Assistente IA <Bot size={22} className="text-teal-500" />
              </h1>
              <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5">
                {appMode === "personal_only" ? "Visão Pessoal" : "Visão Global"}
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 active:scale-95"
          >
            <Settings size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <ContextToggle />
        </div>
      </div>

      {/* MODAL DE CONFIGURAÇÃO DA CHAVE API (BOTTOM SHEET) */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-[32px] p-6 animate-in slide-in-from-bottom-full duration-300 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-[14px] flex items-center justify-center">
                  <Settings size={20} />
                </div>
                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">Configuração IA</h3>
              </div>
              <button type="button" onClick={() => setShowSettings(false)} className="text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-2 block">Chave da API Gemini</label>
                <input
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  type="password"
                  placeholder="Cole sua chave aqui (AIzaSy...)"
                  className="w-full bg-gray-50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-[16px] p-4 text-[14px] font-bold text-gray-800 dark:text-gray-200 appearance-none focus:ring-2 focus:ring-teal-500/30 outline-none transition-all"
                />
              </div>

              {settingsMessage.text && (
                <div className={`flex items-center gap-2 p-3 rounded-[14px] text-[13px] font-bold ${settingsMessage.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
                  {settingsMessage.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                  <span>{settingsMessage.text}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveApiKey}
                className="w-full bg-teal-600 text-white py-4 rounded-[20px] font-bold text-[15px] shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-95 transition-all mt-2"
              >
                Salvar Chave
              </button>

              <div className="pt-4 text-center">
                <p className="text-[12px] text-gray-500 dark:text-gray-400 font-medium">
                  Obtenha sua chave gratuitamente no <br />
                  <a href="https://aistudio.google.com/app/apikeys" target="_blank" rel="noreferrer" className="text-teal-600 dark:text-teal-400 hover:underline font-bold">Google AI Studio</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        {loading ? (
          <AssistantSkeleton />
        ) : (
          <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* CARD RESUMO FINANCEIRO PREMIUM */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[28px] p-6 shadow-lg shadow-indigo-600/20 group cursor-default">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-[14px] flex items-center justify-center border border-white/10 shadow-inner">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <h3 className="font-bold text-[16px] text-white tracking-wide">Base de Conhecimento IA</h3>
                </div>
                
                <div className="flex justify-between items-end bg-black/10 rounded-[20px] p-4 backdrop-blur-sm border border-white/5">
                  <div>
                    <p className="text-indigo-100 text-[11px] font-bold uppercase tracking-widest mb-1">Saldo Histórico</p>
                    <p className="text-[26px] font-black text-white tracking-tight leading-none">{formatCurrency(stats.balance)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-indigo-100 text-[11px] font-bold uppercase tracking-widest mb-1">Evolução</p>
                    <p className={`text-[15px] font-black ${stats.lastMonthChange >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {stats.lastMonthChange >= 0 ? '+' : ''}{stats.lastMonthChange.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* QUICK STATS */}
            <div className="grid grid-cols-2 gap-3">
              {quickStats.map((stat, index) => {
                const Icon = stat.icon
                return (
                  <div key={index} className={`rounded-[24px] p-4 border border-gray-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 shadow-[0_2px_15px_rgba(0,0,0,0.02)] transition-transform`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-[36px] h-[36px] rounded-[12px] flex items-center justify-center ${stat.bg}`}>
                        <Icon size={18} className={stat.color} />
                      </div>
                      <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400 tracking-wide">{stat.label}</span>
                    </div>
                    <p className={`text-[18px] font-black text-gray-800 dark:text-gray-100 tracking-tight`}>{stat.value}</p>
                  </div>
                )
              })}
            </div>

            {/* INSIGHTS RÁPIDOS */}
            <div className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-gray-100 dark:border-slate-700/50">
              <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 mb-5 flex items-center gap-2">
                <Brain size={20} className="text-indigo-500" />
                Destaques para a IA
              </h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 group">
                  <div className="w-[42px] h-[42px] rounded-[14px] bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                    <Wallet size={20} className="text-teal-600 dark:text-teal-400" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">Média mensal (Trimestre)</p>
                    <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{formatCurrency(stats.monthlyAverage)}</p>
                  </div>
                </div>
                
                {stats.biggestCategory && (
                  <div className="flex items-center gap-4 group">
                    <div className="w-[42px] h-[42px] rounded-[14px] bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                      <PieChart size={20} className="text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">Principal gasto histórico</p>
                      <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{stats.biggestCategory} • {formatCurrency(stats.biggestCategoryAmount)}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-4 group">
                  <div className="w-[42px] h-[42px] rounded-[14px] bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">Volume de dados lidos</p>
                    <p className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{stats.transactionCount} registros processados</p>
                  </div>
                </div>
              </div>
            </div>

            {/* AÇÕES DA IA */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push('/assistant/chat')}
                className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-slate-700/50 hover:border-teal-500/30 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-[18px] bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageSquare size={26} className="text-teal-600 dark:text-teal-400" />
                </div>
                <div className="text-center mt-1">
                  <span className="block text-[15px] font-black text-gray-800 dark:text-gray-100 tracking-tight">Chat Inteligente</span>
                  <span className="block text-[11px] font-medium text-gray-400 mt-0.5">Tire dúvidas financeiras</span>
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => router.push('/assistant/report')}
                className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] border border-gray-100 dark:border-slate-700/50 hover:border-indigo-500/30 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-[18px] bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText size={26} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-center mt-1">
                  <span className="block text-[15px] font-black text-gray-800 dark:text-gray-100 tracking-tight">Relatório DFL</span>
                  <span className="block text-[11px] font-medium text-gray-400 mt-0.5">Análise escrita por IA</span>
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
