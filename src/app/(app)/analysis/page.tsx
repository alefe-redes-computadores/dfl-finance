'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, ChevronRight, Loader2, ArrowLeft, MoreHorizontal, TrendingUp
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isSameMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as PieTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as BarTooltip,
  AreaChart, Area
} from 'recharts'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'

type TabType = 'month' | 'new_expenses'

function ReportsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const currentContext = context || 'dfl'

  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [activeTab, setActiveTab] = useState<TabType>('month')
  
  // Estados do Mês Atual
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [prevTotalExpense, setPrevTotalExpense] = useState(0)
  const [pieData, setPieData] = useState<any[]>([])

  // Estados Históricos (Gráficos 6 e 12 meses)
  const [sixMonthData, setSixMonthData] = useState<any[]>([])
  const [twelveMonthData, setTwelveMonthData] = useState<any[]>([])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const formatShortCurrency = (val: number) => {
    if (val >= 1000) return `R$ ${(val / 1000).toFixed(1).replace('.0', '')} mil`
    return `R$ ${val}`
  }

  const loadReportData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    try {
      // 1. Definir os períodos
      const currentStart = startOfMonth(currentDate)
      const currentEnd = endOfMonth(currentDate)
      const prevStart = startOfMonth(subMonths(currentDate, 1))
      const prevEnd = endOfMonth(subMonths(currentDate, 1))
      
      const sixMonthsAgo = startOfMonth(subMonths(currentDate, 5))
      const twelveMonthsAgo = startOfMonth(subMonths(currentDate, 11))

      const startStr = format(currentStart, 'yyyy-MM-dd')
      const endStr = format(currentEnd, 'yyyy-MM-dd')
      const twelveStr = format(twelveMonthsAgo, 'yyyy-MM-dd')

      // 2. Busca todas as transações dos últimos 12 meses (status 'done')
      const { data: txData } = await supabase
        .from('transactions')
        .select('amount, type, date, category_id, notes')
        .eq('user_id', user.id)
        .eq('context', currentContext)
        .gte('date', twelveStr)
        .lte('date', endStr)
        .eq('status', 'done')

      const transactions = Array.isArray(txData) ? txData : []

      // 3. Busca categorias
      const { data: catData } = await supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('user_id', user.id)
      const categories = Array.isArray(catData) ? catData : []

      // --- PROCESSAMENTO DO MÊS ATUAL E ANTERIOR ---
      let currentIncome = 0
      let currentExpense = 0
      let previousExpense = 0
      const categoryTotals: Record<string, any> = {}

      transactions.forEach(tx => {
        const txDate = parseISO(tx.date)
        const amount = Number(tx.amount) || 0
        const isCurrentMonth = isSameMonth(txDate, currentDate)
        const isPrevMonth = isSameMonth(txDate, subMonths(currentDate, 1))
        const isRefund = tx.notes?.includes('[Devolução/Estorno]')

        if (tx.type === 'income') {
          if (isCurrentMonth) currentIncome += amount
        } else if (tx.type === 'expense' || tx.type === 'sangria') {
          const finalAmount = isRefund ? -amount : amount // Abate se for estorno

          if (isCurrentMonth) {
            currentExpense += finalAmount
            
            // Agrupamento para o gráfico de pizza (apenas despesas positivas)
            if (finalAmount > 0) {
              const catId = tx.category_id || 'unassigned'
              if (!categoryTotals[catId]) {
                const catInfo = categories.find(c => c.id === catId)
                categoryTotals[catId] = {
                  id: catId,
                  name: catInfo?.name || 'Outros',
                  color: catInfo?.color || '#cbd5e1',
                  icon: catInfo?.icon || 'Tag',
                  value: 0
                }
              }
              categoryTotals[catId].value += finalAmount
            }
          }

          if (isPrevMonth) {
            previousExpense += finalAmount
          }
        }
      })

      setTotalIncome(currentIncome)
      setTotalExpense(currentExpense)
      setPrevTotalExpense(previousExpense)

      const formattedPieData = Object.values(categoryTotals).sort((a: any, b: any) => b.value - a.value)
      setPieData(formattedPieData)

      // --- PROCESSAMENTO: FLUXO MENSAL (6 MESES) ---
      const sixMonthsDataMap: Record<string, { month: string, income: number, expense: number, sortKey: number }> = {}
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(currentDate, i)
        const key = format(m, 'yyyy-MM')
        sixMonthsDataMap[key] = { month: format(m, 'MMM', { locale: ptBR }), income: 0, expense: 0, sortKey: m.getTime() }
      }

      // --- PROCESSAMENTO: PATRIMÔNIO (12 MESES) ---
      const twelveMonthsDataMap: Record<string, { month: string, balance: number, sortKey: number }> = {}
      for (let i = 11; i >= 0; i--) {
        const m = subMonths(currentDate, i)
        const key = format(m, 'yyyy-MM')
        twelveMonthsDataMap[key] = { month: format(m, 'MMM', { locale: ptBR }), balance: 0, sortKey: m.getTime() }
      }

      // Acumulador para o patrimônio (Simplificado: Receitas - Despesas ao longo do tempo)
      let cumulativeBalance = 0

      // Precisamos ordenar as transações por data crescente para o acumulado funcionar
      const sortedTxs = [...transactions].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())

      sortedTxs.forEach(tx => {
        const txDate = parseISO(tx.date)
        const monthKey = format(txDate, 'yyyy-MM')
        const amount = Number(tx.amount) || 0
        const isRefund = tx.notes?.includes('[Devolução/Estorno]')
        
        let netFlow = 0

        if (tx.type === 'income') {
          netFlow = amount
          if (sixMonthsDataMap[monthKey]) sixMonthsDataMap[monthKey].income += amount
        } else if (tx.type === 'expense' || tx.type === 'sangria') {
          netFlow = isRefund ? amount : -amount // Inverte se for despesa, volta a ser positivo se for estorno
          if (sixMonthsDataMap[monthKey]) sixMonthsDataMap[monthKey].expense += isRefund ? -amount : amount
        }

        cumulativeBalance += netFlow
        if (twelveMonthsDataMap[monthKey]) {
          twelveMonthsDataMap[monthKey].balance = cumulativeBalance
        }
      })

      // Se um mês não teve transação, ele herda o saldo do mês anterior
      let lastKnownBalance = 0
      Object.keys(twelveMonthsDataMap).sort().forEach(key => {
        if (twelveMonthsDataMap[key].balance === 0 && lastKnownBalance !== 0) {
           twelveMonthsDataMap[key].balance = lastKnownBalance
        } else {
           lastKnownBalance = twelveMonthsDataMap[key].balance
        }
      })

      setSixMonthData(Object.values(sixMonthsDataMap).sort((a, b) => a.sortKey - b.sortKey))
      setTwelveMonthData(Object.values(twelveMonthsDataMap).sort((a, b) => a.sortKey - b.sortKey))

    } catch (err) {
      console.error('Erro ao carregar análises:', err)
    } finally {
      setLoading(false)
    }
  }, [user, currentContext, currentDate])

  useEffect(() => {
    loadReportData()
  }, [loadReportData])

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))

  const currentBalance = totalIncome - totalExpense
  const expenseVariation = prevTotalExpense > 0 
    ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100 
    : 0

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f4f7f8] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      
      {/* Header Estilo Mobills */}
      <div className="bg-[#f4f7f8] dark:bg-slate-900 px-5 pt-6 pb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-light text-gray-800 dark:text-gray-100 tracking-tight">Análise</h1>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="text-gray-800 dark:text-gray-200">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())}
            </span>
            <button onClick={nextMonth} className="text-gray-800 dark:text-gray-200">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Abas */}
        <div className="flex bg-gray-200/50 dark:bg-slate-800 rounded-xl p-1 mb-4">
          <button 
            onClick={() => setActiveTab('month')}
            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${
              activeTab === 'month' 
                ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            No mês
          </button>
          <button 
            onClick={() => setActiveTab('new_expenses')}
            className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-all ${
              activeTab === 'new_expenses' 
                ? 'bg-white dark:bg-slate-700 text-gray-800 dark:text-gray-100 shadow-sm' 
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Novos gastos
          </button>
        </div>

        <div className="mb-2">
          <ContextToggle />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="animate-spin text-teal-500 mb-4" size={40} />
        </div>
      ) : (
        <div className="px-4 space-y-4 animate-in fade-in duration-500">
          
          {activeTab === 'month' ? (
            <>
              {/* Cartão Balanço do Mês */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
                <p className="text-center text-[13px] text-gray-500 dark:text-gray-400 font-medium mb-5">Balanço do mês</p>
                <div className="flex items-center">
                  {/* Pílulas coloridas */}
                  <div className="flex gap-1.5 mr-5">
                    <div className="w-4 h-[72px] bg-[#22c55e] rounded-full"></div>
                    <div className="w-4 h-[72px] bg-[#ef4444] rounded-full"></div>
                  </div>
                  {/* Valores */}
                  <div className="flex-1 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-gray-600 dark:text-gray-400 font-medium">Receitas</span>
                      <span className="text-[14px] text-[#22c55e] font-bold">{formatCurrency(totalIncome)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-gray-600 dark:text-gray-400 font-medium">Despesas</span>
                      <span className="text-[14px] text-[#ef4444] font-bold">{formatCurrency(totalExpense)}</span>
                    </div>
                    <div className="border-t border-gray-100 dark:border-slate-700 my-1"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-gray-800 dark:text-gray-200 font-bold">Balanço</span>
                      <span className={`text-[14px] font-bold ${currentBalance >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {formatCurrency(currentBalance)}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Tag variação */}
                {totalExpense > 0 && prevTotalExpense > 0 && (
                  <div className="mt-5 flex justify-center">
                    <div className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                      expenseVariation > 0 
                        ? 'bg-red-50 dark:bg-red-900/30 text-[#ef4444]' 
                        : 'bg-emerald-50 dark:bg-emerald-900/30 text-[#22c55e]'
                    }`}>
                      Despesas {expenseVariation > 0 ? '+' : ''}{expenseVariation.toFixed(1)}% vs mês anterior
                    </div>
                  </div>
                )}
              </div>

              {/* Cartão Gráfico de Pizza & Lista */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
                {pieData.length > 0 ? (
                  <>
                    <div className="h-56 w-full relative mb-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={85}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Total Gasto</span>
                        <span className="text-[16px] font-bold text-gray-800 dark:text-gray-100 mt-0.5">
                          {formatCurrency(totalExpense)}
                        </span>
                      </div>
                    </div>

                    <div className="text-center mb-6">
                      <h3 className="font-bold text-gray-800 dark:text-gray-100">Despesas por categoria</h3>
                      <p className="text-[11px] text-gray-400 mt-1">Visão detalhada do seu fluxo de caixa</p>
                    </div>

                    <div className="space-y-5">
                      {pieData.map((item) => {
                        const percentage = ((item.value / totalExpense) * 100).toFixed(1)
                        const IconComp = getDynamicIcon(item.icon)
                        return (
                          <div key={item.id} className="relative border-b border-gray-50 dark:border-slate-700/50 pb-4 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <IconComp size={16} color={item.color} />
                                <p className="text-[13px] font-bold text-gray-700 dark:text-gray-200 truncate max-w-[120px]">{item.name}</p>
                              </div>
                              <div className="text-right flex items-center gap-2">
                                <div>
                                  <p className="text-[13px] font-bold text-gray-800 dark:text-gray-100">{formatCurrency(item.value)}</p>
                                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">{percentage}%</p>
                                </div>
                                <ChevronDown size={16} className="text-gray-300" />
                              </div>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: item.color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 text-gray-400">Nenhuma despesa registrada.</div>
                )}
              </div>

              {/* Fluxo Mensal (BarChart) */}
              <div className="mt-8 mb-4 flex justify-between items-end px-2">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-[15px]">Fluxo mensal</h3>
                <span className="text-[12px] text-gray-400">Últimos 6 meses</span>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
                <div className="flex gap-4 mb-6">
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]" /><span className="text-[11px] text-gray-500 font-medium">Receitas</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /><span className="text-[11px] text-gray-500 font-medium">Despesas</span></div>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sixMonthData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShortCurrency} />
                      <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={16} />
                      <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Patrimônio (AreaChart) */}
              <div className="mt-8 mb-4 flex justify-between items-end px-2">
                <h3 className="font-bold text-gray-800 dark:text-gray-100 text-[15px]">Patrimônio</h3>
                <span className="text-[12px] text-gray-400">12 meses</span>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[11px] text-gray-500 font-medium mb-1">Saldo acumulado</p>
                    <p className="text-xl font-bold text-gray-800 dark:text-gray-100">
                      {formatCurrency(twelveMonthData[twelveMonthData.length - 1]?.balance || 0)}
                    </p>
                  </div>
                </div>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={twelveMonthData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={formatShortCurrency} />
                      <Area type="monotone" dataKey="balance" stroke="#34d399" strokeWidth={3} fillOpacity={1} fill="url(#colorBalance)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : (
            /* ABA: NOVOS GASTOS */
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-slate-700">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
                   <TrendingUp size={20} className="text-rose-400" />
                </div>
                <div>
                  <p className="text-[12px] text-gray-500 font-medium">Novos gastos do mês</p>
                  <p className="text-[16px] font-bold text-gray-800 dark:text-gray-100">{formatCurrency(totalExpense)}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                 <div>
                    <p className="text-[10px] text-gray-400 font-medium">Categorias</p>
                    <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">{pieData.length}</p>
                 </div>
                 <div>
                    <p className="text-[10px] text-gray-400 font-medium">Média</p>
                    <p className="text-[13px] font-bold text-rose-400">{formatCurrency(totalExpense / (pieData.length || 1))}</p>
                 </div>
                 <div>
                    <p className="text-[10px] text-gray-400 font-medium">Maior peso</p>
                    <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate">{pieData[0]?.name || '-'}</p>
                 </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <ContextProvider>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#22c55e]" size={40} /></div>}>
        <ReportsContent />
      </Suspense>
    </ContextProvider>
  )
}
