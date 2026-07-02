'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Plus, RefreshCw, Target, TrendingUp, TrendingDown,
  CheckCircle2, Clock, AlertTriangle, PauseCircle, Wallet
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { formatCurrency } from '@/lib/utils'

// ============================================================
// SKELETON LOADER
// ============================================================
const GoalsSkeleton = () => (
  <div className="space-y-3 animate-pulse">
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

export default function GoalsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all')

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
      loadGoals().finally(() => setRefreshing(false))
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
    loadGoals()
  }, [user?.id, context, filter])

  const loadGoals = async () => {
    setLoading(true)
    setLoadingPulse(true)

    let query = supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    setGoals(Array.isArray(data) ? data : [])
    setLoading(false)
    setLoadingPulse(false)
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed':
        return { label: 'Concluída', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400' }
      case 'paused':
        return { label: 'Pausada', icon: PauseCircle, color: 'text-gray-500 bg-gray-100 dark:bg-slate-700' }
      case 'active':
      default:
        return { label: 'Em andamento', icon: Clock, color: 'text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400' }
    }
  }

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500'
      case 'paused': return 'bg-gray-400'
      default: return 'bg-teal-500'
    }
  }

  const filteredGoals = goals.filter(g => {
    if (filter === 'all') return true
    return g.status === filter
  })

  const totalGoals = filteredGoals.length
  const averageProgress = filteredGoals.length > 0
    ? filteredGoals.reduce((acc, g) => {
        const progress = Number(g.target_amount) > 0
          ? (Number(g.current_amount || 0) / Number(g.target_amount)) * 100
          : 0
        return acc + Math.min(progress, 100)
      }, 0) / filteredGoals.length
    : 0

  const filters = [
    { key: 'all', label: 'Todas' },
    { key: 'active', label: 'Ativas' },
    { key: 'completed', label: 'Concluídas' },
    { key: 'paused', label: 'Pausadas' },
  ]

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {/* Indicador de carregamento sutil */}
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

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
          onClick={() => router.push('/goals/new')}
          className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-teal-700/20 active:scale-90 transition-transform"
        >
          <Plus size={20} className="text-white" />
        </button>
      </div>

      <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Metas Financeiras</h2>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap transition-all border ${
              filter === f.key
                ? 'bg-teal-700 text-white border-teal-700 shadow-md'
                : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            {f.label} {f.key !== 'all' && (
              <span className="ml-1 text-[10px] opacity-70">
                ({goals.filter(g => g.status === f.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <GoalsSkeleton />
      ) : filteredGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Target size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">
            {filter === 'all' ? 'Nenhuma meta cadastrada' : `Nenhuma meta ${filter === 'active' ? 'ativa' : filter === 'completed' ? 'concluída' : 'pausada'}`}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
            Defina metas financeiras para acompanhar seu progresso.
          </p>
          <button
            onClick={() => router.push('/goals/new')}
            className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors"
          >
            Nova meta
          </button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
                <Target size={16} className="text-teal-600 dark:text-teal-400" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Total de metas</p>
              <p className="text-[15px] font-bold text-teal-600">{totalGoals}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-bold mb-1">Progresso médio</p>
              <p className="text-[15px] font-bold text-emerald-600">{averageProgress.toFixed(0)}%</p>
            </div>
          </div>

          {/* Lista */}
          {filteredGoals.map(goal => {
            const IconComp = getDynamicIcon(goal.icon || 'target')
            const progress = Number(goal.target_amount) > 0
              ? (Number(goal.current_amount || 0) / Number(goal.target_amount)) * 100
              : 0
            const statusConfig = getStatusConfig(goal.status)
            const progressColor = getProgressColor(goal.status)
            const isCompleted = goal.status === 'completed'

            return (
              <div
                key={goal.id}
                onClick={() => router.push(`/goals/${goal.id}`)}
                className={`bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.98] ${
                  isCompleted ? 'border-emerald-200 dark:border-emerald-800' :
                  goal.status === 'paused' ? 'border-gray-200 dark:border-gray-700' :
                  'border-gray-50 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${goal.color || '#14b8a6'}20`, color: goal.color || '#14b8a6' }}>
                      <IconComp size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200 truncate max-w-[180px]">
                        {goal.name}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {formatCurrency(Number(goal.current_amount || 0))} / {formatCurrency(Number(goal.target_amount))}
                      </p>
                    </div>
                  </div>
                  <div className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${statusConfig.color}`}>
                    <statusConfig.icon size={12} />
                    {statusConfig.label}
                  </div>
                </div>

                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>

                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-400 dark:text-gray-500 font-medium">
                    {isCompleted ? 'Meta concluída' : `${Math.min(progress, 100).toFixed(0)}% alcançado`}
                  </span>
                  {goal.deadline && (
                    <span className="text-gray-400 dark:text-gray-500 font-medium">
                      {format(new Date(goal.deadline), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}