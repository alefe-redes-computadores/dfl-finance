'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ContextToggle } from '@/components/ContextToggle'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import { 
  ArrowLeft, 
  TrendingDown, 
  TrendingUp, 
  Wallet,
  DollarSign,
  Calendar,
  Tag,
  CreditCard,
  AlertCircle
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import DetailedProjectionChart from '@/components/DetailedProjectionChart'

// Cores para gráficos
const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#84cc16', '#6366f1']

// Cores mais suaves para área
const AREA_COLORS = {
  income: '#10b981',
  expense: '#ef4444',
}

// ============================================
// PÁGINA DE ANÁLISES
// ============================================
export default function AnalysisPage() {
  const router = useRouter()
  const supabase = createClient()

  const [context, setContext] = useState<'pf' | 'pj'>('pf')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Totais
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [balance, setBalance] = useState(0)

  // Dados para gráficos
  const [categoryData, setCategoryData] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [evolutionData, setEvolutionData] = useState<any[]>([])
  const [weekdayData, setWeekdayData] = useState<any[]>([])

  // Período
  const [periodMonths, setPeriodMonths] = useState(6)

  useEffect(() => {
    const stored = localStorage.getItem('dfl-context') as 'pf' | 'pj' | null
    if (stored) setContext(stored)
  }, [])

  useEffect(() => {
    fetchAnalysisData()
  }, [context, periodMonths])

  async function fetchAnalysisData() {
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const hoje = new Date()
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() - (periodMonths - 1), 1)
    const inicioStr = inicio.toISOString().split('T')[0]
    const hojeStr = hoje.toISOString().split('T')[0]

    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .gte('date', inicioStr)
      .lte('date', hojeStr)
      .order('date', { ascending: true })

    if (txError) {
      console.error('Erro ao buscar dados:', txError)
      setError('Erro ao carregar dados. Tente novamente.')
      setLoading(false)
      return
    }

    if (!txData || txData.length === 0) {
      setLoading(false)
      return
    }

    processData(txData)
    setLoading(false)
  }

  function processData(txData: any[]) {
    const doneTx = txData.filter(t => t.status === 'done')
    
    // Totais
    const income = doneTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
    const expense = doneTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
    setTotalIncome(income)
    setTotalExpense(expense)
    setBalance(income - expense)

    // Por categoria (apenas despesas)
    const expenseByCategory: Record<string, number> = {}
    doneTx.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category_id || 'outros'
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(t.amount)
    })
    const catData = Object.entries(expenseByCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    setCategoryData(catData)

    // Evolução mensal
    const monthlyMap: Record<string, { income: number; expense: number }> = {}
    doneTx.forEach(t => {
      const mes = t.date.substring(0, 7)
      if (!monthlyMap[mes]) monthlyMap[mes] = { income: 0, expense: 0 }
      if (t.type === 'income') monthlyMap[mes].income += Number(t.amount)
      else monthlyMap[mes].expense += Number(t.amount)
    })
    const monthlyArr = Object.entries(monthlyMap)
      .map(([mes, val]) => ({
        mes: formatMonth(mes),
        receitas: val.income,
        despesas: val.expense,
        saldo: val.income - val.expense,
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
    setMonthlyData(monthlyArr)

    // Evolução patrimonial (acumulado)
    let acumulado = 0
    const dailyMap: Record<string, number> = {}
    doneTx.forEach(t => {
      const dia = t.date
      const valor = t.type === 'income' ? Number(t.amount) : -Number(t.amount)
      dailyMap[dia] = (dailyMap[dia] || 0) + valor
    })
    const evolutionArr = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, valor]) => {
        acumulado += valor
        return { dia, saldo: acumulado }
      })
    setEvolutionData(evolutionArr)

    // Gastos por dia da semana (apenas despesas)
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const weekdayTotals: number[] = [0, 0, 0, 0, 0, 0, 0]
    doneTx.filter(t => t.type === 'expense').forEach(t => {
      const d = new Date(t.date + 'T00:00:00')
      const dow = d.getDay()
      weekdayTotals[dow] += Number(t.amount)
    })
    const weekdayArr = diasSemana.map((nome, i) => ({
      dia: nome,
      valor: weekdayTotals[i],
    }))
    setWeekdayData(weekdayArr)
  }

  function formatMonth(mes: string): string {
    const [ano, mesNum] = mes.split('-')
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${meses[parseInt(mesNum) - 1]}/${ano.slice(2)}`
  }

  const handleContextChange = (newContext: 'pf' | 'pj') => {
    setContext(newContext)
    localStorage.setItem('dfl-context', newContext)
  }

  // ============================================
  // RENDER
  // ============================================
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <Button onClick={fetchAnalysisData} variant="outline">
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Análises</h1>
          </div>
          <ContextToggle context={context} onToggle={handleContextChange} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Seletor de período */}
        <div className="flex items-center gap-2">
          <Button
            variant={periodMonths === 3 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodMonths(3)}
          >
            3 meses
          </Button>
          <Button
            variant={periodMonths === 6 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodMonths(6)}
          >
            6 meses
          </Button>
          <Button
            variant={periodMonths === 12 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriodMonths(12)}
          >
            12 meses
          </Button>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">Receitas</p>
                  </div>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(totalIncome)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">Despesas</p>
                  </div>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(totalExpense)}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-blue-500" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">Saldo</p>
                  </div>
                  <p className={`text-lg font-bold ${balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(balance)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Gráfico de Pizza - Gastos por Categoria */}
            {categoryData.length > 0 && (
              <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Gastos por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={50}
                          paddingAngle={3}
                          label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {categoryData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 justify-center">
                    {categoryData.map((cat, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">{cat.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gráfico de Barras - Mensal */}
            {monthlyData.length > 0 && (
              <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Receitas vs Despesas (Mensal)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} barSize={24} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '12px' }}
                          iconType="circle"
                        />
                        <Bar dataKey="receitas" fill={AREA_COLORS.income} name="Receitas" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="despesas" fill={AREA_COLORS.expense} name="Despesas" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gráfico de Área - Evolução Patrimonial */}
            {evolutionData.length > 0 && (
              <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Evolução Patrimonial
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={evolutionData}>
                        <defs>
                          <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="dia" 
                          tick={{ fontSize: 10, fill: '#94a3b8' }} 
                          axisLine={false} 
                          tickLine={false} 
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="saldo"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#colorSaldo)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* PROJEÇÃO DE SALDO DETALHADA (DEEP DIVE) */}
            <DetailedProjectionChart />

            {/* Gastos por dia da semana */}
            {weekdayData.length > 0 && (
              <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Gastos por Dia da Semana
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weekdayData} barSize={30}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} hide />
                        <Tooltip 
                          formatter={(value: number) => formatCurrency(value)}
                          contentStyle={{
                            backgroundColor: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="valor" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Gastos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sem dados */}
            {categoryData.length === 0 && monthlyData.length === 0 && evolutionData.length === 0 && (
              <Card className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <DollarSign className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400 text-center">
                    Nenhum dado disponível para o período selecionado.
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 text-center">
                    Adicione transações para visualizar as análises.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}