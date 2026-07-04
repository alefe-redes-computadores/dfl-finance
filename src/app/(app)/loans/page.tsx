'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Plus, Loader2, RefreshCw, ArrowRightLeft,
  TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle, User, Building2
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'

// ============================================================
// SKELETON LOADER
// ============================================================
const LoansSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
          <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    ))}
  </div>
)

function LoansContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context, appMode } = useContext_()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const { data: localLoans, loading: loansLoading, reload: reloadLoans } = useLocalData({
    table: 'loans',
    filters: { context },
    orderBy: { field: 'created_at', direction: 'desc' },
    realtime: true,
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions',
    filters: { context },
    realtime: true,
  })

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
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

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadData = async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)
    try {
      await Promise.all([reloadLoans(), reloadTransactions()])
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }

  useEffect(() => {
    if (user?.id) loadData()
  }, [user?.id, context])

  // ============================================================
  // PROCESSAMENTO EM MEMÓRIA
  // ============================================================
  const loansWithProgress = (localLoans || []).map((loan: any) => {
    const payments = (localTransactions || [])
      .filter((tx: any) => tx.loan_id === loan.id && tx.type === 'income')
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)

    const remaining = Number(loan.total_amount) - payments
    const percent = Number(loan.total_amount) > 0 ? (payments / Number(loan.total_amount)) * 100 : 0

    return {
      ...loan,
      paid_amount: payments,
      remaining,
      percent: Math.min(percent, 100),
      isCompleted: remaining <= 0
    }
  })

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este empréstimo?')) return
    try {
      const { remove } = useLocalData({ table: 'loans' })
      await remove(id)
      showToast('Empréstimo excluído.', 'info')
      loadData()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const getContextLabel = (ctx: string) => ctx === 'dfl' ? 'PJ' : 'PF'

  if (appMode === 'personal_only') {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
              <ChevronLeft size={24} />
            </button>
            <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Empréstimos</h2>
          </div>
        </div>
        <div className="text-center py-20">
          <ArrowRightLeft size={56} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Modo Apenas PF</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[280px] mx-auto">
            Empréstimos entre contextos (PF e PJ) só estão disponíveis no modo completo.
          </p>
          <button onClick={() => router.push('/more')} className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors">
            Ativar modo PF e PJ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Empréstimos</h2>
        </div>
        <button onClick={() => router.push('/loans/new')} className="w-9 h-9 bg-teal-700 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform">
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <div className="mb-4">
        <ContextToggle />
      </div>

      {loading ? (
        <LoansSkeleton />
      ) : loansWithProgress.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <ArrowRightLeft size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum empréstimo</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Registre empréstimos entre PF e PJ para controlar saldos devedores.
          </p>
          <button onClick={() => router.push('/loans/new')} className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors">
            Novo empréstimo
          </button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          {loansWithProgress.map((loan: any) => {
            const isCompleted = loan.isCompleted
            const remaining = loan.remaining
            const dueDate = loan.due_date ? new Date(loan.due_date) : null
            const daysUntilDue = dueDate ? differenceInDays(dueDate, new Date()) : null
            const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isCompleted

            return (
              <div
                key={loan.id}
                onClick={() => router.push(`/loans/${loan.id}`)}
                className={`bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border cursor-pointer hover:shadow-md transition-all active:scale-[0.98] ${
                  isCompleted 
                    ? 'border-emerald-200 dark:border-emerald-800' 
                    : isOverdue 
                      ? 'border-red-200 dark:border-red-800' 
                      : 'border-gray-50 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                      <ArrowRightLeft size={20} className="text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-gray-500">{getContextLabel(loan.source_context)}</span>
                        <ArrowRightLeft size={10} className="text-gray-400" />
                        <span className="text-[11px] text-gray-500">{getContextLabel(loan.dest_context)}</span>
                      </div>
                      <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{loan.description || 'Empréstimo'}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    isCompleted 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                      : isOverdue 
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                        : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                  }`}>
                    {isCompleted ? 'Pago' : isOverdue ? 'Atrasado' : `${loan.percent.toFixed(0)}%`}
                  </span>
                </div>

                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${Math.min(loan.percent, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500 dark:text-gray-400">
                    {isCompleted ? 'Total pago' : `Falta ${formatCurrency(Math.max(remaining, 0))}`}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">
                    {loan.percent.toFixed(0)}% • {formatCurrency(Number(loan.total_amount))}
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

export default function LoansPage() {
  return (
    <ContextProvider>
      <LoansContent />
    </ContextProvider>
  )
}