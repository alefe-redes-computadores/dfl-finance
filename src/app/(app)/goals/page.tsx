'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Plus, Target, Edit3, Trash2,
  TrendingUp, Calendar, CheckCircle2, PauseCircle
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'
import Skeleton from '@/components/Skeleton'

export default function GoalsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [goals, setGoals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 size={14} className="text-emerald-500" />
      case 'paused': return <PauseCircle size={14} className="text-amber-500" />
      default: return <TrendingUp size={14} className="text-teal-500" />
    }
  }

  const getSourceLabel = (goal: any) => {
    if (goal.categories?.name) return `Categoria: ${goal.categories.name}`
    if (goal.tags?.name) return `Tag: ${goal.tags.name}`
    if (goal.accounts?.name) return `Conta: ${goal.accounts.name}`
    return 'Manual'
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Metas {goals.length > 0 && `(${goals.length})`}
          </h1>
          <button onClick={() => router.push('/goals/new')} className="p-2 -mr-2 text-teal-700 dark:text-teal-400">
            <Plus size={24} />
          </button>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            <Skeleton variant="card" height="120px" count={3} />
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-16">
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

            return (
              <div key={goal.id}
                onClick={() => router.push(`/goals/${goal.id}`)}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 50}ms` }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
                      <IconComp size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{goal.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{getSourceLabel(goal)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {getStatusIcon(goal.status)}
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
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      goal.status === 'completed' ? 'bg-emerald-500' : progress >= 80 ? 'bg-teal-500' : progress >= 50 ? 'bg-amber-500' : 'bg-blue-500'
                    }`} style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold" style={{ color: goal.color }}>{progress.toFixed(0)}% concluído</span>
                  {goal.deadline && (
                    <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                      <Calendar size={12} />
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