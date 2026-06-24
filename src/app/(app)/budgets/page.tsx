'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import * as Icons from 'lucide-react'
import { 
  ChevronLeft, ChevronRight, Plus, Loader2, TrendingUp, PieChart, Calendar, X
} from 'lucide-react'
import { format, subMonths, addMonths, startOfMonth, endOfMonth, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'

// Helper para renderizar os ícones dinamicamente
const getDynamicIcon = (iconName: string) => {
  if (!iconName) return Icons.Tag
  const formattedName = iconName.charAt(0).toUpperCase() + iconName.slice(1)
  return (Icons as any)[formattedName] || Icons.Tag
}

function BudgetsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [budgets, setBudgets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarTransactions, setCalendarTransactions] = useState<any[]>([])

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const loadBudgets = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const { data: budgetsData } = await supabase
      .from('budgets')
      .select('*, categories(name, icon, color)')
      .match({ user_id: user.id, context: context })
      .order('created_at', { ascending: false })

    const { data: transactions } = await supabase
      .from('transactions')
      .select('category_id, amount, type, status, date, description, categories(name, icon, color)')
      .match({ user_id: user.id, context: context })
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: false })

    const txs = Array.isArray(transactions) ? transactions : []

    const budgetsWithSpent = (budgetsData || []).map(budget => {
      const spent = txs
        .filter(t => t.category_id === budget.category_id && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const remaining = Number(budget.amount) - spent
      const percent = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0
      return { ...budget, spent, remaining, percent: Math.min(percent, 100) }
    })

    setBudgets(budgetsWithSpent)

    // Dados para o calendário (transações pendentes e efetivadas)
    const calendarTxs = txs.filter(t => t.type === 'expense' || t.type === 'sangria')
    setCalendarTransactions(calendarTxs)

    setLoading(false)
  }, [user, context, currentDate])

  useEffect(() => { loadBudgets() }, [loadBudgets])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const totalBudgeted = budgets.reduce((a, b) => a + (Number(b.amount) || 0), 0)
  const totalSpent = budgets.reduce((a, b) => a + (b.spent || 0), 0)
  const totalPercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0

  // Agrupa transações por data para o calendário
  const groupedByDate: Record<string, any[]> = {}
  calendarTransactions.forEach(tx => {
    const key = tx.date
    if (!groupedByDate[key]) groupedByDate[key] = []
    groupedByDate[key].push(tx)
  })

  const dateLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    if (isToday(d)) return 'HOJE'
    if (isYesterday(d)) return 'ONTEM'
    return format(d, "dd 'de' MMM", { locale: ptBR })
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <ContextToggle />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCalendar(true)}
            className="w-9 h-9 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 rounded-full flex items-center justify-center"
          >
            <Calendar size={18} className="text-gray-700 dark:text-gray-300" />
          </button>
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 px-3 py-1.5 rounded-full">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={18} /></button>
            <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-wide">{monthLabel}</span>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronRight size={18} /></button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Orçamentos</h2>
        <button
          onClick={() => router.push('/budgets/new')}
          className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-teal-700" size={32} /></div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <PieChart size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum orçamento</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Crie orçamentos para controlar seus gastos por categoria e nunca mais estourar o limite.
          </p>
          <button
            onClick={() => router.push('/budgets/new')}
            className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm"
          >
            Criar orçamento
          </button>
        </div>
      ) : (
        <>
          {/* Card Resumo */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                  <TrendingUp size={20} className="text-teal-700 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase">Orçado</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{formatCurrency(totalBudgeted)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase">Gasto</p>
                <p className="text-lg font-bold text-red-500">{formatCurrency(totalSpent)}</p>
              </div>
            </div>
            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${totalPercent >= 100 ? 'bg-red-500' : totalPercent >= 75 ? 'bg-orange-500' : 'bg-teal-500'}`}
                style={{ width: `${Math.min(totalPercent, 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium text-right">
              {totalPercent.toFixed(0)}% utilizado
            </p>
          </div>

          {/* Lista de Orçamentos */}
          <div className="space-y-3">
            {budgets.map(budget => {
              const IconComp = getDynamicIcon(budget.categories?.icon)
              const isOverBudget = budget.remaining < 0
              const isWarning = budget.percent >= 75 && budget.percent < 100

              return (
                <div
                  key={budget.id}
                  onClick={() => router.push(`/budgets/${budget.id}`)}
                  className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${budget.color}20`, color: budget.color }}>
                        <IconComp size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{budget.name}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{budget.categories?.name || 'Todas as categorias'}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isOverBudget ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      isWarning ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    }`}>
                      {isOverBudget ? 'Estourado' : isWarning ? 'Atenção' : 'Dentro do limite'}
                    </span>
                  </div>

                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out ${
                        isOverBudget ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-teal-500'
                      }`}
                      style={{ width: `${Math.min(budget.percent, 100)}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400 dark:text-gray-500 font-medium">Gasto {formatCurrency(budget.spent)}</span>
                    <span className="text-gray-400 dark:text-gray-500 font-medium">Orçado {formatCurrency(Number(budget.amount))}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modal Calendário de Faturas */}
      {showCalendar && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50" onClick={() => setShowCalendar(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sticky top-0 bg-white dark:bg-slate-800 py-2">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Compromissos do mês</h3>
              <button onClick={() => setShowCalendar(false)} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full"><X size={20} /></button>
            </div>
            {Object.keys(groupedByDate).length === 0 ? (
              <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-10">Nenhuma despesa neste mês.</p>
            ) : (
              <div className="space-y-6">
                {Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)).map(date => (
                  <div key={date}>
                    <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 mb-2 px-1">{dateLabel(date)}</p>
                    <div className="space-y-2">
                      {groupedByDate[date].map((tx: any) => {
                        const IconComp = getDynamicIcon(tx.categories?.icon)
                        return (
                          <div key={tx.id} className="bg-gray-50 dark:bg-slate-700 rounded-xl p-3 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${tx.categories?.color || '#64748b'}20`, color: tx.categories?.color || '#64748b' }}>
                              <IconComp size={16} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{tx.description || tx.categories?.name || 'Despesa'}</p>
                              <p className="text-[11px] text-gray-400 dark:text-gray-500">{tx.categories?.name || 'Geral'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-red-500">- {formatCurrency(Number(tx.amount) || 0)}</p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500">{tx.status === 'done' ? 'Pago' : 'Pendente'}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BudgetsPage() {
  return (
    <ContextProvider>
      <BudgetsContent />
    </ContextProvider>
  )
}
