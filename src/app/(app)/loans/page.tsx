'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Plus, ArrowRightLeft, RefreshCw, TrendingUp, TrendingDown,
  Calendar, CheckCircle2, Clock, AlertTriangle, Building2, User
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'

// ============================================================
// SKELETON LOADER
// ============================================================
const LoansSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {/* Cards de resumo */}
    <div className="grid grid-cols-2 gap-3 mb-6">
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-5 w-24 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 mx-auto mb-2" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-1" />
        <div className="h-5 w-24 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
    </div>

    {/* Cards de empréstimo */}
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
          </div>
          <div className="h-6 w-20 bg-gray-200 dark:bg-slate-700 rounded-full" />
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
          <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-1/2" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    ))}
  </div>
)

export default function LoansPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [loans, setLoans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
      loadLoans().finally(() => setRefreshing(false))
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

  useEffect(() => {
    if (!user?.id) return
    loadLoans()
  }, [user?.id, context])

  const loadLoans = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('loans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setLoans(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getContextLabel = (ctx: string) => ctx === 'dfl' ? 'PJ' : 'PF'
  const getContextIcon = (ctx: string) =>
    ctx === 'dfl' ? <Building2 size={14} className="text-blue-500" /> : <User size={14} className="text-emerald-500" />

  const totalToReceive = loans
    .filter(l => l.status === 'active' && l.dest_context === context)
    .reduce((a, l) => a + (Number(l.remaining_amount) || 0), 0)

  const totalToPay = loans
    .filter(l => l.status === 'active' && l.source_context === context)
    .reduce((a, l) => a + (Number(l.remaining_amount) || 0), 0)

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

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
          <ChevronLeft size={24} />
        </button>
        <ContextToggle />
        <button
          onClick={() => router.push('/loans/new')}
          className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Empréstimos entre Contextos</h2>

      {loading ? (
        <LoansSkeleton />
      ) : loans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <ArrowRightLeft size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum empréstimo</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Registre transferências entre PF e PJ como empréstimos para acompanhar o saldo devedor.
          </p>
          <button
            onClick={() => router.push('/loans/new')}
            className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm"
          >
            Novo empréstimo
          </button>
        </div>
      ) : (
        <div className="animate-in fade-in duration-300">
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">A receber</p>
              <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(totalToReceive)}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-2">
                <TrendingDown size={16} className="text-red-500" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">A pagar</p>
              <p className="text-[15px] font-bold text-red-500">{formatCurrency(totalToPay)}</p>
            </div>
          </div>

          {/* Lista de empréstimos */}
          <div className="space-y-3">
            {loans.map(loan => {
              const progress = Number(loan.total_amount) > 0
                ? ((Number(loan.total_amount) - Number(loan.remaining_amount)) / Number(loan.total_amount)) * 100
                : 0
              const isCompleted = loan.status === 'completed'
              const isCancelled = loan.status === 'cancelled'
              const isActive = loan.status === 'active'
              const daysUntilDue = loan.due_date ? differenceInDays(new Date(loan.due_date), new Date()) : null
              const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && isActive

              return (
                <div
                  key={loan.id}
                  onClick={() => router.push(`/loans/${loan.id}`)}
                  className={`bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98] ${
                    isOverdue ? 'border-red-200 dark:border-red-800' :
                    isCompleted ? 'border-emerald-200 dark:border-emerald-800' :
                    'border-gray-50 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isActive ? 'bg-teal-50 dark:bg-teal-900/30' :
                        isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/30' :
                        'bg-gray-100 dark:bg-slate-700'
                      }`}>
                        <ArrowRightLeft size={20} className={
                          isActive ? 'text-teal-600 dark:text-teal-400' :
                          isCompleted ? 'text-emerald-600 dark:text-emerald-400' :
                          'text-gray-400'
                        } />
                      </div>
                      <div>
                        <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200">
                          {getContextLabel(loan.source_context)} → {getContextLabel(loan.dest_context)}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {loan.description || 'Empréstimo'}
                          {' • '}
                          {loan.paid_installments}/{loan.total_installments} parcelas
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isCompleted && <CheckCircle2 size={16} className="text-emerald-500" />}
                      {isCancelled && <AlertTriangle size={16} className="text-gray-400" />}
                      {isOverdue && <AlertTriangle size={16} className="text-red-500" />}
                      {isActive && !isOverdue && <Clock size={16} className="text-teal-500" />}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' :
                        isCancelled ? 'bg-gray-100 dark:bg-slate-700 text-gray-500' :
                        isOverdue ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                        'bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400'
                      }`}>
                        {isCompleted ? 'Quitado' : isCancelled ? 'Cancelado' : isOverdue ? 'Atrasado' : 'Ativo'}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all duration-700 ${
                      isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'
                    }`} style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>

                  <div className="flex justify-between text-[11px]">
                    <span className="text-gray-400 dark:text-gray-500 font-medium">
                      {isCompleted ? 'Total pago' : `Falta ${formatCurrency(Number(loan.remaining_amount) || 0)}`}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 font-medium">
                      {progress.toFixed(0)}% • {formatCurrency(Number(loan.total_amount))}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
