'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, ChevronRight, PieChart as PieChartIcon,
  TrendingDown, TrendingUp, Loader2, Wallet, ArrowLeft
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'

function ReportsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const currentContext = context || 'dfl'

  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Estados de dados
  const [totalIncome, setTotalIncome] = useState(0)
  const [totalExpense, setTotalExpense] = useState(0)
  const [pieData, setPieData] = useState<any[]>([])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const loadReportData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    try {
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

      // 1. Busca as transações do mês (ignorando as pendentes para o relatório real)
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('context', currentContext)
        .gte('date', start)
        .lte('date', end)
        .neq('status', 'pending') // Análises geralmente olham para o que foi pago/recebido

      if (txError) throw txError

      const transactions = Array.isArray(txData) ? txData : []

      // 2. Busca categorias para o Join manual (À prova de falhas)
      const { data: catData } = await supabase
        .from('categories')
        .select('id, name, icon, color')
        .eq('user_id', user.id)

      const categories = Array.isArray(catData) ? catData : []

      // 3. Separa Receitas e Despesas
      let incomeSum = 0
      let expenseSum = 0
      const categoryTotals: Record<string, any> = {}

      transactions.forEach(tx => {
        const amount = Number(tx.amount) || 0

        if (tx.type === 'income') {
          incomeSum += amount
        } else if (tx.type === 'expense' || tx.type === 'sangria') {
          // Ignora devoluções/estornos na soma total de despesas se a flag existir
          if (tx.notes && tx.notes.includes('[Devolução/Estorno]')) {
             // Abate do gasto
             expenseSum -= amount
             return // Pula o resto para não adicionar no gráfico
          }

          expenseSum += amount

          // Agrupa por categoria para o Gráfico de Pizza
          const catId = tx.category_id || 'unassigned'
          if (!categoryTotals[catId]) {
            const catInfo = categories.find(c => c.id === catId)
            categoryTotals[catId] = {
              id: catId,
              name: catInfo?.name || 'Outros / Geral',
              color: catInfo?.color || '#94a3b8',
              icon: catInfo?.icon || 'Tag',
              value: 0
            }
          }
          categoryTotals[catId].value += amount
        }
      })

      setTotalIncome(incomeSum)
      setTotalExpense(expenseSum)

      // 4. Prepara os dados para o gráfico de pizza (Ordenados do maior pro menor)
      const formattedPieData = Object.values(categoryTotals)
        .sort((a: any, b: any) => b.value - a.value)

      setPieData(formattedPieData)

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

  // Tooltip customizado para o gráfico ficar bonito no mobile
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }}></div>
            <p className="font-bold text-[13px] text-gray-800 dark:text-gray-100 uppercase tracking-tight">
              {data.name}
            </p>
          </div>
          <p className="text-[14px] font-bold text-gray-600 dark:text-gray-300 ml-5">
            {formatCurrency(data.value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      
      {/* Header Fixo */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Análises</h1>
          <div className="w-10"></div> {/* Espaçador para centralizar o título */}
        </div>

        {/* Toggle Contexto */}
        <div className="mb-4">
          <ContextToggle />
        </div>

        {/* Seletor de Mês */}
        <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-2xl p-1">
          <button onClick={prevMonth} className="p-2 text-gray-500 hover:text-teal-700 dark:text-gray-400 dark:hover:text-teal-400 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-widest">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button onClick={nextMonth} className="p-2 text-gray-500 hover:text-teal-700 dark:text-gray-400 dark:hover:text-teal-400 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="animate-spin text-teal-700 mb-4" size={40} />
          <p className="text-sm text-gray-400 font-medium">Processando análises...</p>
        </div>
      ) : (
        <div className="px-4 pt-6 space-y-6 animate-in fade-in duration-500">
          
          {/* Cards de Resumo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                  <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Receitas</span>
              </div>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {formatCurrency(totalIncome)}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl shadow-sm border border-gray-50 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                  <TrendingDown size={16} className="text-red-600 dark:text-red-400" />
                </div>
                <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Despesas</span>
              </div>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {formatCurrency(totalExpense)}
              </p>
            </div>

            <div className="col-span-2 bg-gradient-to-br from-teal-700 to-[#82a99c] p-5 rounded-3xl shadow-md text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 -mr-4 -mt-4 opacity-10">
                <Wallet size={120} />
              </div>
              <span className="text-[12px] font-bold text-teal-100 uppercase tracking-wider block mb-1">
                Saldo do Período
              </span>
              <p className="text-3xl font-light tracking-tight">
                {formatCurrency(currentBalance)}
              </p>
            </div>
          </div>

          {/* Gráfico de Pizza (Despesas por Categoria) */}
          <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-gray-50 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                <PieChartIcon size={20} className="text-teal-700 dark:text-teal-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 uppercase tracking-tight">Despesas por Categoria</h2>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">Onde seu dinheiro foi gasto</p>
              </div>
            </div>

            {pieData.length > 0 ? (
              <>
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Texto central do Gráfico */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                    <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                      {formatCurrency(totalExpense).replace('R$ ', '')}
                    </span>
                  </div>
                </div>

                {/* Lista de Categorias com Barra de Progresso */}
                <div className="mt-6 space-y-4">
                  {pieData.map((item) => {
                    const percentage = ((item.value / totalExpense) * 100).toFixed(1)
                    const IconComp = getDynamicIcon(item.icon)
                    return (
                      <div key={item.id} className="relative">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${item.color}20`, color: item.color }}>
                              <IconComp size={16} />
                            </div>
                            <div>
                              <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 uppercase tracking-tight">{item.name}</p>
                              <p className="text-[10px] text-gray-400 font-bold">{percentage}%</p>
                            </div>
                          </div>
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200">
                            {formatCurrency(item.value)}
                          </p>
                        </div>
                        {/* Barra de progresso da categoria */}
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${percentage}%`, backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-10">
                <div className="w-16 h-16 bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <PieChartIcon size={24} className="text-gray-300 dark:text-gray-500" />
                </div>
                <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Nenhuma despesa registrada neste mês.</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <ContextProvider>
      <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-700" size={40} /></div>}>
        <ReportsContent />
      </Suspense>
    </ContextProvider>
  )
}
