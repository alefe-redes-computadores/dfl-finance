'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Plus, Target, RefreshCw
} from 'lucide-react'
import { differenceInDays } from 'date-fns'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useGoalsList } from '@/hooks/useGoalsList' // ✅ NOVO HOOK
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

  // ✅ HOOK ESPECÍFICO DE LISTAGEM
  const { data: localGoals, loading: goalsLoading } = useGoalsList(effectiveContext)

  // ✅ TRANSAÇÕES ainda vêm via useLocalData para calcular progresso
  const { data: localTransactions, loading: txLoading } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

  const loading = goalsLoading || txLoading

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  // ✅ REMOVIDO pull-to-refresh manual (useGoalsList já é reativo)
  // Mantido apenas para compatibilidade com a UI, mas sem reload

  const goalsWithProgress = useMemo(() => {
    return (localGoals || []).map((goal: any) => {
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
  }, [localGoals, localTransactions])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div
      ref={containerRef}
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300"
    >
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => { vibrate([5]); router.push('/more'); }}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Metas
                </h1>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  {appMode === "personal_only" ? "Visão pessoal" : "Visão global"}
                </p>
              </div>
            </div>

            <button
              onClick={() => { vibrate([10]); router.push('/goals/new'); }}
              className="h-11 w-11 rounded-[18px] bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] shrink-0"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="min-w-0">
            <ContextToggle />
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        {loading ? (
          <div className="space-y-3">
            <Skeleton count={3} height="118px" borderRadius="24px" />
          </div>
        ) : goalsWithProgress.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <Target size={28} className="opacity-30 text-gray-500" />
            </div>
            <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
              Nenhuma meta ativa
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-[12px] mt-1 mb-5 max-w-[250px]">
              Defina metas financeiras para acompanhar seu progresso.
            </p>
            <button
              onClick={() => { vibrate([10]); router.push('/goals/new'); }}
              className="bg-teal-600 text-white px-8 py-3.5 rounded-[20px] font-bold text-[14px] hover:bg-teal-700 transition-colors shadow-lg shadow-teal-600/20 active:scale-[0.98]"
            >
              Criar primeira meta
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in duration-500">
            {goalsWithProgress.map((goal: any) => {
              const IconComp = getDynamicIcon(goal.icon || 'target')
              const isCompleted = goal.isCompleted
              const isOverdue = goal.daysLeft < 0 && !isCompleted

              return (
                <div
                  key={goal.id}
                  onClick={() => { vibrate([5]); router.push(`/goals/details?id=${goal.id}`); }}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2 cursor-pointer"
                >
                  <div className="rounded-[18px] p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98] transition-all">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm"
                          style={{ backgroundColor: `${goal.color}15`, color: goal.color }}
                        >
                          <IconComp size={18} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {goal.name}
                          </p>
                          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                            {isCompleted ? 'Concluída' : isOverdue ? 'Atrasada' : `${goal.daysLeft} dias restantes`}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          isCompleted
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                            : isOverdue
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                        }`}
                      >
                        {goal.percent.toFixed(0)}%
                      </span>
                    </div>

                    <div className="w-full bg-gray-100 dark:bg-slate-700/60 rounded-full h-2.5 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'
                        }`}
                        style={{ width: `${goal.percent}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatCurrency(goal.saved)} de {formatCurrency(Number(goal.target_amount))}
                      </span>
                      <span className={`${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`}>
                        {isCompleted ? 'Meta atingida' : `Falta ${formatCurrency(goal.remaining)}`}
                      </span>
                    </div>
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
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  if (!isClient) return <div className="min-h-screen bg-[#f8f9fa] dark:bg-slate-900" />

  return (
    <ContextProvider>
      <GoalsContent />
    </ContextProvider>
  )
}