'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Plus, Target, RefreshCw
} from 'lucide-react'
import { differenceInDays } from 'date-fns'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import Skeleton from '@/components/Skeleton'

function GoalsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { appMode, context } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { showToast } = useToast()
  const { vibrate } = useHapticFeedback()
  
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const { data: localGoals, loading: goalsLoading, reload: reloadGoals } = useLocalData({
    table: 'goals' as any,
    filters: { context: effectiveContext },
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

  const loading = goalsLoading || txLoading

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
      vibrate([10])
      Promise.all([reloadGoals(), reloadTransactions()]).finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => { isPulling.current = false }

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
  }, [loading, refreshing, vibrate])

  const goalsWithProgress = (localGoals || []).map((goal: any) => {
    const saved = (localTransactions || [])
      .filter((tx: any) => tx.goal_id === goal.id && tx.type === 'income' && tx.status === 'done')
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

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl pt-6 pb-2 px-4 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border-b border-gray-100 dark:border-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <button onClick={() => { vibrate([5]); router.push('/more'); }} className="p-1 -ml-1 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-[26px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Metas</h1>
            </div>
            <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5 ml-1">
              {appMode === "personal_only" ? "Visão Pessoal" : "Visão Global"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { vibrate([10]); router.push('/goals/new'); }} className="w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-95">
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="mb-4">
          <ContextToggle />
        </div>
      </div>

      <div className="px-4 pt-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton count={3} height="130px" borderRadius="28px" />
          </div>
        ) : goalsWithProgress.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <Target size={32} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[16px] font-bold text-gray-800 dark:text-gray-200 tracking-tight">Nenhuma meta ativa</p>
            <p className="text-gray-400 dark:text-gray-500 text-[13px] font-medium mt-1 mb-6 max-w-[250px]">
              Defina metas financeiras para acompanhar seu progresso.
            </p>
            <button onClick={() => { vibrate([10]); router.push('/goals/new'); }} className="bg-teal-600 text-white px-8 py-3.5 rounded-full font-bold text-[14px] hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/30 active:scale-95">
              Criar primeira meta
            </button>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in duration-500">
            {goalsWithProgress.map((goal: any) => {
              const IconComp = getDynamicIcon(goal.icon || 'target')
              const isCompleted = goal.isCompleted
              const isOverdue = goal.daysLeft < 0 && !isCompleted

              return (
                <div
                  key={goal.id}
                  onClick={() => { vibrate([5]); router.push(`/goals/details?id=${goal.id}`); }}
                  className={`bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-sm border cursor-pointer hover:shadow-md transition-all active:scale-[0.98] group ${
                    isCompleted ? 'border-emerald-200 dark:border-emerald-800/50' : isOverdue ? 'border-red-200 dark:border-red-800/50' : 'border-gray-50 dark:border-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-[18px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${goal.color}15`, color: goal.color }}>
                      <IconComp size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-[18px] text-gray-800 dark:text-gray-100 truncate tracking-tight leading-tight mb-1">{goal.name}</p>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                        {isCompleted ? '✅ Concluída' : isOverdue ? '⏰ Atrasada' : `${goal.daysLeft} dias restantes`}
                      </p>
                    </div>
                    <span className={`text-[13px] font-black px-3 py-1.5 rounded-[12px] shadow-sm ${
                      isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : isOverdue ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                    }`}>
                      {goal.percent.toFixed(0)}%
                    </span>
                  </div>

                  <div className="w-full bg-gray-100 dark:bg-slate-700/50 rounded-full h-3 overflow-hidden mb-2 shadow-inner">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${goal.percent}%` }} />
                  </div>

                  <div className="flex justify-between text-[11px] font-bold text-gray-400 dark:text-gray-500">
                    <span>
                      {formatCurrency(goal.saved)} <span className="font-medium opacity-70">de {formatCurrency(Number(goal.target_amount))}</span>
                    </span>
                    <span className={isCompleted ? 'text-emerald-600' : ''}>
                      {isCompleted ? 'Meta atingida!' : `Falta ${formatCurrency(goal.remaining)}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
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
