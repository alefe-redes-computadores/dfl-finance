'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Plus, Loader2, RefreshCw, Home, Car, Briefcase,
  TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle
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
const FinancingsSkeleton = () => (
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

function FinancingsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const { data: localFinancings, loading: financingsLoading, reload: reloadFinancings } = useLocalData({
    table: 'financings',
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
      await Promise.all([reloadFinancings(), reloadTransactions()])
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
  const financingsWithProgress = (localFinancings || []).map((financing: any) => {
    const payments = (localTransactions || [])
      .filter((tx: any) => tx.financing_id === financing.id && tx.type === 'expense')
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)

    const paidInstallments = payments > 0 ? Math.floor(payments / Number(financing.installment_value)) : 0
    const remainingInstallments = financing.total_installments - paidInstallments
    const percent = Number(financing.total_installments) > 0 ? (paidInstallments / Number(financing.total_installments)) * 100 : 0

    return {
      ...financing,
      paidInstallments,
      remainingInstallments,
      percent: Math.min(percent, 100),
      isCompleted: paidInstallments >= Number(financing.total_installments)
    }
  })

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este financiamento?')) return
    try {
      const { remove } = useLocalData({ table: 'financings' })
      await remove(id)
      showToast('Financiamento excluído.', 'info')
      loadData()
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Financiamentos</h2>
        </div>
        <button onClick={() => router.push('/financings/new')} className="w-9 h-9 bg-teal-700 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform">
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <div className="mb-4">
        <ContextToggle />
      </div>

      {loading ? (
        <FinancingsSkeleton />
      ) : financingsWithProgress.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Home size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum financiamento</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Registre financiamentos para acompanhar suas parcelas.
          </p>
          <button onClick={() => router.push('/financings/new')} className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors">
            Novo financiamento
          </button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          {financingsWithProgress.map((financing: any) => {
            const IconComp = getDynamicIcon(financing.icon || 'home')
            const isCompleted = financing.isCompleted
            const isOverdue = financing.next_due_date && differenceInDays(new Date(financing.next_due_date), new Date()) < 0 && !isCompleted

            return (
              <div
                key={financing.id}
                onClick={() => router.push(`/financings/${financing.id}`)}
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
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${financing.color}20`, color: financing.color }}>
                      <IconComp size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{financing.name}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {formatCurrency(Number(financing.installment_value))} • {financing.total_installments} parcelas
                      </p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    isCompleted 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                      : isOverdue 
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                        : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                  }`}>
                    {isCompleted ? 'Quitado' : isOverdue ? 'Atrasado' : `${financing.percent.toFixed(0)}%`}
                  </span>
                </div>

                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${Math.min(financing.percent, 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500 dark:text-gray-400">
                    {financing.paidInstallments} de {financing.total_installments} parcelas
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">
                    {financing.percent.toFixed(0)}% pago
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

export default function FinancingsPage() {
  return (
    <ContextProvider>
      <FinancingsContent />
    </ContextProvider>
  )
}