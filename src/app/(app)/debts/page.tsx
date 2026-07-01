'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Plus, Users, Wallet, RefreshCw, AlertTriangle, Clock, Check, TrendingUp } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'

// ============================================================
// SKELETON LOADER
// ============================================================
const DebtsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    {/* Cards de resumo */}
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
        <div className="h-3 w-14 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
        <div className="h-3 w-14 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-5 w-10 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
    </div>

    {/* Cards de dívida */}
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
          </div>
          <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
          <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-1/2" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    ))}
  </div>
)

function DebtsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const [debts, setDebts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'active' | 'paid'>('active')
  const [totalToReceive, setTotalToReceive] = useState(0)

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
      loadDebts().finally(() => setRefreshing(false))
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

  const loadDebts = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)

    const { data: debtsData } = await supabase
      .from('debts')
      .select('*')
      .match({ user_id: user.id, context: context })
      .in('status', filter === 'paid' ? ['paid'] : ['pending', 'partial'])
      .order('created_at', { ascending: false })

    const debtsArray = Array.isArray(debtsData) ? debtsData : []

    const debtsWithProgress = await Promise.all(debtsArray.map(async (debt) => {
      const { data: payments } = await supabase
        .from('transactions')
        .select('amount')
        .eq('debt_id', debt.id)
        .eq('type', 'income')

      const paidAmount = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
      const percent = Number(debt.total_amount) > 0 ? (paidAmount / Number(debt.total_amount)) * 100 : 0

      return { ...debt, paid_amount: paidAmount, percent: Math.min(percent, 100) }
    }))

    setDebts(debtsWithProgress)
    setTotalToReceive(debtsWithProgress.reduce((a, d) => a + (Number(d.total_amount) - (d.paid_amount || 0)), 0))
    setLoading(false)
  }, [user, context, filter])

  useEffect(() => { loadDebts() }, [loadDebts])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
        <ContextToggle />
        <button
          onClick={() => router.push('/debts/new')}
          className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Quem me deve</h2>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
          <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-2">
            <Wallet size={16} className="text-orange-600 dark:text-orange-400" />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">A receber</p>
          <p className="text-[15px] font-bold text-orange-600">{formatCurrency(totalToReceive)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
          <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
            <Users size={16} className="text-teal-700 dark:text-teal-400" />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Pessoas</p>
          <p className="text-[15px] font-bold text-teal-700 dark:text-teal-400">{debts.length}</p>
        </div>
      </div>

      <div className="flex bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 p-1 rounded-full mb-6">
        <button
          onClick={() => setFilter('active')}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${filter === 'active' ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setFilter('paid')}
          className={`flex-1 py-2 rounded-full text-[13px] font-bold transition-all ${filter === 'paid' ? 'bg-[#f4f6f8] dark:bg-slate-700 text-gray-900 dark:text-gray-100 shadow-[inset_0_1px_3px_rgba(0,0,0,0.05)]' : 'text-gray-400 dark:text-gray-500'}`}
        >
          Pagos
        </button>
      </div>

      {loading ? (
        <DebtsSkeleton />
      ) : debts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Users size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum registro</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            {filter === 'paid' ? 'Nenhuma dívida foi paga ainda.' : 'Registre empréstimos para acompanhar quem te deve.'}
          </p>
          <button
            onClick={() => router.push('/debts/new')}
            className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors"
          >
            Novo empréstimo
          </button>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-300">
          {debts.map(debt => {
            const IconComp = getDynamicIcon(debt.icon || 'user')
            const isPaid = debt.status === 'paid'
            const remaining = Number(debt.total_amount) - (debt.paid_amount || 0)
            const daysUntilDue = debt.due_date ? differenceInDays(new Date(debt.due_date), new Date()) : null
            const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isPaid
            const isNearDue = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7 && !isPaid

            return (
              <div
                key={debt.id}
                onClick={() => router.push(`/debts/${debt.id}`)}
                className={`bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98] ${
                  isPaid 
                    ? 'border-emerald-200 dark:border-emerald-800' 
                    : isOverdue 
                      ? 'border-red-200 dark:border-red-800' 
                      : 'border-gray-50 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${debt.color}20`, color: debt.color }}>
                      <IconComp size={18} />
                    </div>
                    <div>
                      <span className="font-bold text-[14px] text-gray-800 dark:text-gray-200">{debt.person_name}</span>
                      {debt.description && <p className="text-[11px] text-gray-400 dark:text-gray-500">{debt.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isPaid && <Check size={14} className="text-emerald-500" />}
                    {isOverdue && <AlertTriangle size={14} className="text-red-500" />}
                    {isNearDue && <Clock size={14} className="text-orange-500" />}
                    <span className={`text-[11px] font-bold ${
                      isPaid 
                        ? 'text-emerald-600' 
                        : isOverdue 
                          ? 'text-red-500' 
                          : isNearDue 
                            ? 'text-orange-500' 
                            : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {isPaid 
                        ? 'Pago' 
                        : isOverdue 
                          ? `Atrasado ${Math.abs(daysUntilDue)} dia(s)` 
                          : isNearDue 
                            ? `Vence em ${daysUntilDue} dia(s)` 
                            : ''}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ease-out ${
                      isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : isNearDue ? 'bg-orange-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${Math.min(debt.percent, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className={`font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                    {isPaid ? 'Total pago' : `Falta ${formatCurrency(Math.max(remaining, 0))}`}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 font-medium">
                    {debt.percent.toFixed(0)}% • {formatCurrency(Number(debt.total_amount))}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function DebtsPage() {
  return (
    <ContextProvider>
      <DebtsContent />
    </ContextProvider>
  )
}