'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Plus, Loader2, RefreshCw, Target, TrendingUp, TrendingDown,
  Clock, AlertTriangle, CheckCircle, Wallet, Calendar, Edit3, Trash2, Eye, EyeOff
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { db, addToSyncQueue } from '@/lib/db' // 🔥 ADICIONADO

const GoalsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
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

function GoalsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const { data: localGoals, loading: goalsLoading, reload: reloadGoals } = useLocalData({
    table: 'goals' as any,
    filters: { context },
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context },
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
      await Promise.all([reloadGoals(), reloadTransactions()])
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
  const goalsWithProgress = (localGoals || []).map((goal: any) => {
    const saved = (localTransactions || [])
      .filter((tx: any) => 
        tx.goal_id === goal.id &&
        tx.type === 'income' &&
        tx.status === 'done'
      )
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)

    const remaining = Number(goal.target_amount) - saved
    const percent = Number(goal.target_amount) > 0 ? (saved / Number(goal.target_amount)) * 100 : 0
    const daysLeft = differenceInDays(new Date(goal.deadline), new Date())

    return {
      ...goal,
      saved,
      remaining,
      percent: Math.min(percent, 100),
      daysLeft,
      isCompleted: saved >= Number(goal.target_amount)
    }
  })

  // 🔥 CORRIGIDO: HANDLER DE DELETE COM addToSyncQueue
  const handleDelete = async (id: string) => {
    if (!user) return
    if (!confirm('Excluir esta meta?')) return
    try {
      await db.table('goals').delete(id)
      await addToSyncQueue(user.id, 'goals', 'delete', id, { id })
      showToast('Meta excluída.', 'info')
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
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Metas</h2>
        </div>
        <button onClick={() => router.push('/goals/new')} className="w-9 h-9 bg-teal-700 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform">
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <div className="mb-4">
        <ContextToggle />
      </div>

      {loading ? (
        <GoalsSkeleton />
      ) : goalsWithProgress.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Target size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhuma meta</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Defina metas financeiras para acompanhar seu progresso.
          </p>
          <button onClick={() => router.push('/goals/new')} className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors">
            Criar meta
          </button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          {goalsWithProgress.map((goal: any) => {
            const IconComp = getDynamicIcon(goal.icon || 'target')
            const isCompleted = goal.isCompleted
            const isOverdue = goal.daysLeft < 0 && !isCompleted

            return (
              <div
                key={goal.id}
                onClick={() => router.push(`/goals/${goal.id}`)}
                className={`bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border cursor-pointer hover:shadow-md transition-all active:scale-[0.98] ${
                  isCompleted 
                    ? 'border-emerald-200 dark:border-emerald-800' 
                    : isOverdue 
                      ? 'border-red-200 dark:border-red-800' 
                      : 'border-gray-50 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
                    <IconComp size={24} />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{goal.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {isCompleted ? '✅ Concluída' : isOverdue ? '⏰ Atrasada' : `${goal.daysLeft} dias restantes`}
                    </p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    isCompleted 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' 
                      : isOverdue 
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' 
                        : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400'
                  }`}>
                    {goal.percent.toFixed(0)}%
                  </span>
                </div>

                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${goal.percent}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatCurrency(goal.saved)} de {formatCurrency(Number(goal.target_amount))}
                  </span>
                  <span className="text-gray-400 dark:text-gray-500">
                    {isCompleted ? 'Meta atingida!' : `Falta ${formatCurrency(goal.remaining)}`}
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

export default function GoalsPage() {
  return (
    <ContextProvider>
      <GoalsContent />
    </ContextProvider>
  )
}