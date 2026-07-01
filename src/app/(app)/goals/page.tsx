'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Plus, Target, Edit3, Trash2,
  TrendingUp, Calendar, CheckCircle2, PauseCircle,
  RefreshCw, AlertTriangle, Clock, Play
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'

// ============================================================
// SKELETON LOADER
// ============================================================
const GoalsSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-200 dark:bg-slate-700 rounded-full" />
            <div className="w-7 h-7 bg-gray-200 dark:bg-slate-700 rounded-full" />
            <div className="w-7 h-7 bg-gray-200 dark:bg-slate-700 rounded-full" />
          </div>
        </div>

        <div className="mb-2">
          <div className="flex justify-between mb-1">
            <div className="h-3 w-16 bg-gray-100 dark:bg-slate-700/50 rounded" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-200 dark:bg-slate-700 rounded-full" />
            <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export default function GoalsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [goals, setGoals] = useState<any[]>([])
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
  }, [user?.id, context])

  const loadGoals = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('goals')
      .select('*, categories(name), tags(name), accounts(name)')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('created_at', { ascending: false })

    setGoals(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta meta?')) return
    await supabase.from('goals').delete().eq('id', id)
    showToast('Meta excluída.', 'info')
    loadGoals()
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getProgressPercent = (current: number, target: number) =>
    Math.min((current / target) * 100, 100)

  const getStatusIcon = (status: string, progress: number) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={14} className="text-emerald-500" />
      case 'paused': return <PauseCircle size={14} className="text-amber-500" />
      default: 
        if (progress >= 100) return <CheckCircle2 size={14} className="text-emerald-500" />
        return <Play size={14} className="text-teal-500" />
    }
  }

  const getStatusLabel = (status: string, progress: number) => {
    if (status === 'completed' || progress >= 100) return 'Concluída'
    if (status === 'paused') return 'Pausada'
    return 'Em andamento'
  }

  const getProgressColor = (status: string, progress: number) => {
    if (status === 'completed' || progress >= 100) return 'bg-emerald-500'
    if (status === 'paused') return 'bg-amber-500'
    if (progress >= 80) return 'bg-teal-500'
    if (progress >= 50) return 'bg-blue-500'
    return 'bg-purple-500'
  }

  const getSourceLabel = (goal: any) => {
    if (goal.categories?.name) return `Categoria: ${goal.categories.name}`
    if (goal.tags?.name) return `Tag: ${goal.tags.name}`
    if (goal.accounts?.name) return `Conta: ${goal.accounts.name}`
    return 'Manual'
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {/* Pull to refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Metas {goals.length > 0 && `(${goals.length})`}
          </h1>
          <button onClick={() => router.push('/goals/new')} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:text-teal-800 transition-colors active:scale-90">
            <Plus size={24} />
          </button>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <GoalsSkeleton />
        ) : goals.length === 0 ? (
          <div className="text-center py-16 animate-in fade-in duration-300">
            <Target size={56} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">Nenhuma meta definida</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Crie metas para acompanhar seus objetivos financeiros.</p>
            <button onClick={() => router.push('/goals/new')}
              className="bg-teal-700 text-white px-6 py-3 rounded-2xl font-bold hover:bg-teal-800 transition-colors">
              Criar primeira meta
            </button>
          </div>
        ) : (
          goals.map((goal, index) => {
            const progress = getProgressPercent(Number(goal.current_amount), Number(goal.target_amount))
            const IconComp = getDynamicIcon(goal.icon || 'target')
            const daysLeft = goal.deadline ? differenceInDays(new Date(goal.deadline), new Date()) : null
            const isOverdue = daysLeft !== null && daysLeft < 0
            const isCompleted = goal.status === 'completed' || progress >= 100
            const statusLabel = getStatusLabel(goal.status, progress)
            const progressColor = getProgressColor(goal.status, progress)

            return (
              <div key={goal.id}
                onClick={() => router.push(`/goals/${goal.id}`)}
                className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border cursor-pointer hover:shadow-md transition-all active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 ${
                  isOverdue ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-slate-700'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isCompleted ? 'ring-2 ring-emerald-200 dark:ring-emerald-800' :
                      isOverdue ? 'ring-2 ring-red-200 dark:ring-red-800' : ''
                    }`}
                      style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
                      <IconComp size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{goal.name}</p>
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(goal.status, progress)}
                        <span className={`text-[11px] font-medium ${
                          isCompleted ? 'text-emerald-600 dark:text-emerald-400' :
                          goal.status === 'paused' ? 'text-amber-600 dark:text-amber-400' :
                          'text-teal-600 dark:text-teal-400'
                        }`}>
                          {statusLabel}
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">• {getSourceLabel(goal)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); router.push(`/goals/${goal.id}`) }}
                      className="p-1.5 text-gray-400 hover:text-teal-600 rounded-full transition-colors" title="Editar meta">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(goal.id) }}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-full transition-colors" title="Excluir meta">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-gray-500">{formatCurrency(Number(goal.current_amount))}</span>
                    <span className="font-bold text-gray-400">{formatCurrency(Number(goal.target_amount))}</span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold" style={{ color: goal.color }}>{progress.toFixed(0)}% concluído</span>
                  {goal.deadline && (
                    <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                      {isOverdue ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                      {isOverdue ? `Atrasado ${Math.abs(daysLeft)} dias` : `${daysLeft} dias restantes`}
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}