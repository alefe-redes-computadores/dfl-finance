'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  TrendingUp,
  DollarSign,
  BarChart2,
  PlusCircle,
  MinusCircle,
  Save,
  Eye,
  EyeOff,
  AlertCircle,
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

function ProjectionsContent() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(true)
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

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  // Cálculo de média móvel (3 meses)
  const loadProjections = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    // Buscar saldo atual (soma dos saldos das contas)
    const { data: accounts } = await supabase
      .from('accounts')
      .select('balance')
      .match({ user_id: user.id, context })

    const balance = (accounts || []).reduce((acc, a) => acc + (Number(a.balance) || 0), 0)
    setCurrentBalance(balance)

    // Buscar transações dos últimos 3 meses
    const today = new Date()
    const startDate = format(subMonths(today, 3), 'yyyy-MM-dd')
    const endDate = format(today, 'yyyy-MM-dd')

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, type, date')
      .match({ user_id: user.id, context })
      .gte('date', startDate)
      .lte('date', endDate)

    // Agrupar por mês
    const monthlyMap: Record<string, { income: number; expense: number }> = {}
    for (let i = 3; i >= 1; i--) {
      const monthStart = format(startOfMonth(subMonths(today, i)), 'yyyy-MM')
      monthlyMap[monthStart] = { income: 0, expense: 0 }
    }
    // Adicionar mês atual
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

    // Média de receitas e despesas
    const validMonths = sortedMonths.filter(([_, v]) => v.income > 0 || v.expense > 0)
    const avgIncome =
      validMonths.length > 0
        ? validMonths.reduce((acc, [_, v]) => acc + v.income, 0) / validMonths.length
        : 0
    const avgExpense =
      validMonths.length > 0
        ? validMonths.reduce((acc, [_, v]) => acc + v.expense, 0) / validMonths.length
        : 0

    // Projeção para os próximos meses
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

    // Carregar cenários salvos
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

  // Simulador de cenário
  const handleSimulate = () => {
    const amount = parseFloat(simulatorAmount.replace('.', '').replace(',', '.')) || 0
    if (amount <= 0) return

    const baseData = chartData.map((d, i) => {
      if (i === 0) return { ...d }
      const newSaldo =
        simulatorType === 'expense'
          ? d.saldo - amount
          : d.saldo + amount
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
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:opacity-20" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
        <ReTooltip formatter={(val: number) => formatCurrency(val)} />
        <Area
          type="monotone"
          dataKey="saldo"
          stroke="#14b8a6"
          strokeWidth={2}
          fill="url(#colorSaldo)"
          name="Saldo"
        />
        {data[0]?.simulado && (
          <Area type="monotone" dataKey="saldo" stroke="#f59e0b" strokeWidth={2} fill="none" name="Simulado" />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <ContextToggle />
        <div className="w-8" />
      </div>

      <h1 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-6">Projeções</h1>

      {/* Gráfico de projeção */}
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">
          Saldo Projetado ({projectionMonths} meses)
        </h3>
        {chartData.length > 0 ? (
          renderChart(simulatedData.length > 0 ? simulatedData : chartData)
        ) : (
          <p className="text-center text-gray-400 dark:text-gray-500 py-10">Dados insuficientes para projeção.</p>
        )}
      </div>

      {/* Cards de Gastos Fixos vs Variáveis */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Gastos Fixos (média)</p>
          <p className="text-[15px] font-bold text-red-500">
            {formatCurrency(
              monthlyData.length > 0
                ? monthlyData.slice(-3).reduce((acc, [_, v]) => acc + v.expense, 0) / 3
                : 0
            )}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Gastos Variáveis (média)</p>
          <p className="text-[15px] font-bold text-orange-500">
            {formatCurrency(
              monthlyData.length > 0
                ? monthlyData.slice(-3).reduce((acc, [_, v]) => acc + v.expense * 0.3, 0) / 3
                : 0
            )}
          </p>
        </div>
      </div>

      {/* Botão Simular Cenário */}
      <button
        onClick={() => setShowSimulator(!showSimulator)}
        className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold mb-4 hover:bg-teal-800 transition-colors"
      >
        Simular Cenário
      </button>

      {showSimulator && (
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
          <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Simular impacto</h3>
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase block mb-1">Valor</label>
            <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
              <span className="text-gray-400 dark:text-gray-500 font-bold mr-2">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={simulatorAmount}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '')
                  if (!digits) {
                    setSimulatorAmount('0,00')
                    return
                  }
                  const formatted = (Number(digits) / 100).toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
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
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${
                simulatorType === 'expense'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              Nova Despesa
            </button>
            <button
              onClick={() => setSimulatorType('income')}
              className={`flex-1 py-2 rounded-full text-xs font-bold transition-colors ${
                simulatorType === 'income'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              Nova Receita
            </button>
          </div>
          <button
            onClick={handleSimulate}
            className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors"
          >
            Calcular Impacto
          </button>
        </div>
      )}

      {showSaveScenario && (
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
          <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Salvar cenário</h3>
          <input
            type="text"
            value={saveScenarioName}
            onChange={(e) => setSaveScenarioName(e.target.value)}
            placeholder="Nome do cenário"
            className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 outline-none text-sm text-gray-800 dark:text-gray-200 mb-4"
          />
          <button
            onClick={handleSaveScenario}
            disabled={savingScenario}
            className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50"
          >
            {savingScenario ? 'Salvando...' : 'Salvar Cenário'}
          </button>
        </div>
      )}

      {/* Cenários salvos */}
      {scenarios.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Cenários Salvos</h3>
          {scenarios.map((scenario: any) => (
            <div
              key={scenario.id}
              className={`p-3 rounded-xl mb-2 cursor-pointer ${
                selectedScenarioId === scenario.id
                  ? 'bg-teal-50 dark:bg-teal-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
              onClick={() => setSelectedScenarioId(scenario.id === selectedScenarioId ? null : scenario.id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{scenario.name}</p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500">{scenario.description}</p>
                </div>
                <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                  {formatCurrency(scenario.extra_expense > 0 ? scenario.extra_expense : scenario.extra_income)}
                </span>
              </div>
            </div>
          ))}
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
