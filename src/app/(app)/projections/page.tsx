'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart2,
  PlusCircle,
  MinusCircle,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  Target,
  Calendar,
  Wallet,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { getDynamicIcon } from '@/lib/iconUtils'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
} from 'recharts'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

// ============================================================
// SKELETON LOADER
// ============================================================
const ProjectionsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {/* Gráfico */}
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-48 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      <div className="h-[250px] bg-gray-100 dark:bg-slate-700/50 rounded-xl" />
    </div>

    {/* Cards de média */}
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-2" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
      </div>
    </div>

    {/* Botão simular */}
    <div className="h-12 bg-gray-200 dark:bg-slate-700 rounded-xl" />

    {/* Cenários salvos */}
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-36 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2].map((i) => (
        <div key={i} className="flex justify-between items-center p-3 mb-2">
          <div className="space-y-2">
            <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-40 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
          <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  </div>
)

function ProjectionsContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentBalance, setCurrentBalance] = useState(0)
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [projectionMonths, setProjectionMonths] = useState(3)
  const [chartData, setChartData] = useState<any[]>([])
  const [scenarios, setScenarios] = useState<any[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const [showSimulator, setShowSimulator] = useState(false)
  const [simulatorAmount, setSimulatorAmount] = useState('0,00')
  const [simulatorType, setSimulatorType] = useState<'expense' | 'income'>('expense')
  const [simulatedData, setSimulatedData] = useState<any[]>([])
  const [saveScenarioName, setSaveScenarioName] = useState('')
  const [savingScenario, setSavingScenario] = useState(false)
  const [showSaveScenario, setShowSaveScenario] = useState(false)

  // Pull to refresh
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
      loadProjections().finally(() => setRefreshing(false))
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

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const loadProjections = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const { data: accounts } = await supabase
      .from('accounts')
      .select('balance')
      .match({ user_id: user.id, context })

    const balance = (accounts || []).reduce((acc, a) => acc + (Number(a.balance) || 0), 0)
    setCurrentBalance(balance)

    const today = new Date()
    const startDate = format(subMonths(today, 3), 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, type, date')
      .match({ user_id: user.id, context })
      .gte('date', startDate)
      .lte('date', endDate)

    const monthlyMap: Record<string, { income: number; expense: number }> = {}
    for (let i = 3; i >= 1; i--) {
      const monthStart = format(startOfMonth(subMonths(today, i)), 'yyyy-MM')
      monthlyMap[monthStart] = { income: 0, expense: 0 }
    }
    monthlyMap[format(startOfMonth(today), 'yyyy-MM')] = { income: 0, expense: 0 }

    ;(txs || []).forEach((tx: any) => {
      const monthKey = format(new Date(tx.date), 'yyyy-MM')
      if (monthlyMap[monthKey]) {
        if (tx.type === 'income') {
          monthlyMap[monthKey].income += Number(tx.amount) || 0
        } else {
          monthlyMap[monthKey].expense += Number(tx.amount) || 0
        }
      }
    })

    const sortedMonths = Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b))
    setMonthlyData(sortedMonths)

    const validMonths = sortedMonths.filter(([_, v]) => v.income > 0 || v.expense > 0)
    const avgIncome = validMonths.length > 0 ? validMonths.reduce((acc, [_, v]) => acc + v.income, 0) / validMonths.length : 0
    const avgExpense = validMonths.length > 0 ? validMonths.reduce((acc, [_, v]) => acc + v.expense, 0) / validMonths.length : 0

    const projectionPoints = []
    let runningBalance = balance
    for (let i = 0; i <= projectionMonths; i++) {
      const monthLabel = i === 0 ? 'Atual' : format(addMonths(today, i), 'MMM', { locale: ptBR })
      projectionPoints.push({
        month: monthLabel,
        saldo: Math.round(runningBalance * 100) / 100,
        receitas: Math.round(avgIncome * 100) / 100,
        despesas: Math.round(avgExpense * 100) / 100,
      })
      runningBalance += avgIncome - avgExpense
    }

    setChartData(projectionPoints)

    const { data: savedScenarios } = await supabase
      .from('scenarios')
      .select('*')
      .match({ user_id: user.id, context })
      .order('created_at', { ascending: false })

    setScenarios(savedScenarios || [])
    setLoading(false)
  }, [user, context, projectionMonths])

  useEffect(() => {
    loadProjections()
  }, [loadProjections])

  const handleSimulate = () => {
    const amount = parseFloat(simulatorAmount.replace('.', '').replace(',', '.')) || 0
    if (amount <= 0) return

    const baseData = chartData.map((d, i) => {
      if (i === 0) return { ...d }
      const newSaldo = simulatorType === 'expense' ? d.saldo - amount : d.saldo + amount
      return { ...d, saldo: newSaldo, simulado: true }
    })
    setSimulatedData(baseData)
    setShowSaveScenario(true)
  }

  const handleSaveScenario = async () => {
    if (!user?.id || !saveScenarioName.trim()) return
    setSavingScenario(true)

    const amount = parseFloat(simulatorAmount.replace('.', '').replace(',', '.')) || 0
    const payload = {
      user_id: user.id,
      context,
      name: saveScenarioName,
      description: `${simulatorType === 'expense' ? 'Gasto extra' : 'Receita extra'} de R$ ${formatCurrency(amount)}`,
      extra_income: simulatorType === 'income' ? amount : 0,
      extra_expense: simulatorType === 'expense' ? amount : 0,
    }

    const { error } = await supabase.from('scenarios').insert(payload)
    if (!error) {
      setShowSimulator(false)
      setShowSaveScenario(false)
      setSimulatorAmount('0,00')
      loadProjections()
    } else {
      alert('Erro ao salvar cenário.')
    }
    setSavingScenario(false)
  }

  const renderChart = (data: any[]) => (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
          </linearGradient>
          {data[0]?.simulado && (
            <linearGradient id="colorSimulado" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <ReTooltip formatter={(val: number) => formatCurrency(val)} />
        <Area type="monotone" dataKey="saldo" stroke="#14b8a6" strokeWidth={2} fill="url(#colorSaldo)" name="Saldo" />
        {data[0]?.simulado && (
          <Area type="monotone" dataKey="saldo" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" fill="url(#colorSimulado)" name="Simulado" />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      {/* Pull to refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <ContextToggle />
        <div className="w-8" />
      </div>

      <h1 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-6">Projeções</h1>

      {loading ? (
        <ProjectionsSkeleton />
      ) : (
        <div className="animate-in fade-in duration-300">
          {/* Gráfico principal */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100">
                Saldo Projetado ({projectionMonths} meses)
              </h3>
              <div className="flex gap-1">
                {[3, 6, 12].map((m) => (
                  <button
                    key={m}
                    onClick={() => setProjectionMonths(m)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all active:scale-95 ${
                      projectionMonths === m
                        ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
            {chartData.length > 0 ? (
              renderChart(simulatedData.length > 0 ? simulatedData : chartData)
            ) : (
              <div className="text-center py-10">
                <BarChart2 size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 dark:text-gray-500">Dados insuficientes para projeção.</p>
              </div>
            )}
            {simulatedData.length > 0 && (
              <div className="flex items-center gap-2 mt-3 justify-center">
                <div className="w-3 h-0.5 bg-teal-500 rounded-full" />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Projeção atual</span>
                <div className="w-3 h-0.5 bg-amber-500 rounded-full" style={{ borderStyle: 'dashed' }} />
                <span className="text-[10px] text-gray-500 dark:text-gray-400">Cenário simulado</span>
                <button
                  onClick={() => { setSimulatedData([]); setShowSaveScenario(false) }}
                  className="text-[10px] text-red-500 font-bold ml-2 hover:underline"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>

          {/* Cards de média */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                  <TrendingDown size={12} className="text-red-500" />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold">Gastos Fixos (média)</p>
              </div>
              <p className="text-[15px] font-bold text-red-500 mt-1">
                {formatCurrency(monthlyData.length > 0 ? monthlyData.slice(-3).reduce((acc, [_, v]) => acc + v.expense, 0) / 3 : 0)}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center">
                  <TrendingDown size={12} className="text-orange-500" />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold">Gastos Variáveis (média)</p>
              </div>
              <p className="text-[15px] font-bold text-orange-500 mt-1">
                {formatCurrency(monthlyData.length > 0 ? monthlyData.slice(-3).reduce((acc, [_, v]) => acc + v.expense * 0.3, 0) / 3 : 0)}
              </p>
            </div>
          </div>

          {/* Botão Simular */}
          <button
            onClick={() => setShowSimulator(!showSimulator)}
            className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold mb-4 hover:bg-teal-800 transition-colors active:scale-[0.98] shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            {showSimulator ? 'Ocultar Simulador' : 'Simular Cenário'}
          </button>

          {/* Simulador */}
          {showSimulator && (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Simular impacto</h3>
              <div className="mb-4">
                <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Valor</label>
                <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3 focus-within:ring-2 focus-within:ring-teal-500 transition-all">
                  <span className="text-gray-400 dark:text-gray-500 font-bold mr-2">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={simulatorAmount}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '')
                      if (!digits) { setSimulatorAmount('0,00'); return }
                      const formatted = (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      setSimulatorAmount(formatted)
                    }}
                    className="bg-transparent w-full outline-none font-bold text-gray-800 dark:text-gray-200 text-lg"
                    placeholder="0,00"
                  />
                </div>
              </div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSimulatorType('expense')}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    simulatorType === 'expense'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <ArrowDown size={12} />
                  Nova Despesa
                </button>
                <button
                  onClick={() => setSimulatorType('income')}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                    simulatorType === 'income'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <ArrowUp size={12} />
                  Nova Receita
                </button>
              </div>
              <button
                onClick={handleSimulate}
                className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Target size={16} />
                Calcular Impacto
              </button>
            </div>
          )}

          {/* Salvar cenário */}
          {showSaveScenario && (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Salvar cenário</h3>
              <input
                type="text"
                value={saveScenarioName}
                onChange={(e) => setSaveScenarioName(e.target.value)}
                placeholder="Nome do cenário"
                className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 outline-none text-sm text-gray-800 dark:text-gray-200 mb-4 focus:ring-2 focus:ring-teal-500 transition-all"
              />
              <button
                onClick={handleSaveScenario}
                disabled={savingScenario}
                className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {savingScenario ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {savingScenario ? 'Salvando...' : 'Salvar Cenário'}
              </button>
            </div>
          )}

          {/* Cenários salvos */}
          {scenarios.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 animate-in fade-in duration-300">
              <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Cenários Salvos</h3>
              {scenarios.map((scenario: any) => (
                <div
                  key={scenario.id}
                  className={`p-3 rounded-xl mb-2 cursor-pointer transition-all active:scale-[0.98] ${
                    selectedScenarioId === scenario.id
                      ? 'bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800'
                      : 'hover:bg-gray-50 dark:hover:bg-slate-700 border border-transparent'
                  }`}
                  onClick={() => setSelectedScenarioId(scenario.id === selectedScenarioId ? null : scenario.id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{scenario.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{scenario.description}</p>
                    </div>
                    <span className={`text-[13px] font-bold ${
                      scenario.extra_expense > 0 ? 'text-red-500' : 'text-emerald-600'
                    }`}>
                      {scenario.extra_expense > 0 ? '- ' : '+ '}
                      {formatCurrency(scenario.extra_expense > 0 ? scenario.extra_expense : scenario.extra_income)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ProjectionsPage() {
  return (
    <ContextProvider>
      <ProjectionsContent />
    </ContextProvider>
  )
}