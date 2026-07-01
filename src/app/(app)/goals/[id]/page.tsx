'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Edit3, Trash2, Loader2, Target,
  TrendingUp, Calendar, CheckCircle2, PauseCircle, Plus, X, Check,
  RefreshCw, AlertTriangle, Clock, Play, ArrowUp
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'

// ============================================================
// SKELETON LOADER
// ============================================================
const GoalDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-4 space-y-4">
    {/* Card principal */}
    <div className="rounded-2xl p-5 bg-gray-200 dark:bg-slate-700 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-white/20 rounded-xl" />
        <div className="space-y-2">
          <div className="h-5 w-32 bg-white/20 rounded" />
          <div className="h-3 w-20 bg-white/10 rounded" />
        </div>
      </div>
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <div className="h-4 w-16 bg-white/20 rounded" />
          <div className="h-4 w-20 bg-white/20 rounded" />
        </div>
        <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
          <div className="h-full bg-white/30 rounded-full w-2/3" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-12 bg-white/20 rounded" />
        <div className="h-4 w-24 bg-white/10 rounded" />
      </div>
    </div>

    {/* Botões de ação */}
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-gray-200 dark:bg-slate-700 rounded-2xl" />
      ))}
    </div>

    {/* Detalhes */}
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-3">
      <div className="h-5 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex justify-between">
          <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-4 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      ))}
    </div>
  </div>
)

export default function GoalDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [goal, setGoal] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Modal de ajuste manual
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)

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
      loadGoal().finally(() => setRefreshing(false))
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
    if (!user?.id || !params?.id) return
    loadGoal()
  }, [user?.id, params?.id])

  const loadGoal = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('goals')
      .select('*, categories(name), tags(name), accounts(name)')
      .eq('id', params.id)
      .single()

    if (!data) {
      router.push('/goals')
      return
    }
    setGoal(data)
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!confirm('Excluir esta meta?')) return
    await supabase.from('goals').delete().eq('id', params.id)
    showToast('Meta excluída.', 'info')
    router.push('/goals')
  }

  const handleToggleStatus = async () => {
    const newStatus = goal.status === 'active' ? 'paused' : 'active'
    await supabase.from('goals').update({ status: newStatus }).eq('id', params.id)
    setGoal({ ...goal, status: newStatus })
    showToast(newStatus === 'active' ? 'Meta reativada!' : 'Meta pausada.', 'info')
  }

  // Ajuste manual de valor
  const openAdjustModal = () => {
    setAdjustAmount('')
    setShowAdjustModal(true)
  }

  const handleSaveAdjust = async () => {
    const rawAmount = parseFloat(adjustAmount.replace(',', '.'))
    if (isNaN(rawAmount) || rawAmount <= 0) {
      showToast('Informe um valor válido.', 'warning')
      return
    }
    setAdjustSaving(true)
    const newCurrent = Number(goal.current_amount) + rawAmount
    const newStatus = newCurrent >= Number(goal.target_amount) ? 'completed' : goal.status

    await supabase
      .from('goals')
      .update({ current_amount: newCurrent, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', params.id)

    setGoal({ ...goal, current_amount: newCurrent, status: newStatus })
    setShowAdjustModal(false)
    showToast(`R$ ${formatCurrency(rawAmount)} adicionado à meta!`, 'success')
    setAdjustSaving(false)
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Skeleton enquanto carrega
  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
        <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4 animate-pulse">
            <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
            <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
              <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
            </div>
          </div>
          <div className="h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
        </div>
        <GoalDetailSkeleton />
      </div>
    )
  }

  if (!goal) return null

  const progress = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)
  const IconComp = getDynamicIcon(goal.icon || 'target')
  const daysLeft = goal.deadline ? differenceInDays(new Date(goal.deadline), new Date()) : null
  const isOverdue = daysLeft !== null && daysLeft < 0
  const isCompleted = goal.status === 'completed' || progress >= 100
  const isPaused = goal.status === 'paused'

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

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/goals')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            {isCompleted && <CheckCircle2 size={18} className="text-emerald-500" />}
            {isPaused && <PauseCircle size={18} className="text-amber-500" />}
            {!isCompleted && !isPaused && <Play size={18} className="text-teal-500" />}
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate max-w-[180px]">{goal.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(`/goals/${goal.id}/edit`)} className="p-2 text-gray-400 hover:text-teal-600 transition-colors">
              <Edit3 size={18} />
            </button>
            <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4 animate-in fade-in duration-300">
        {/* Card principal */}
        <div className={`rounded-2xl p-5 text-white shadow-lg relative overflow-hidden ${
          isCompleted ? 'ring-2 ring-emerald-300 dark:ring-emerald-700' :
          isOverdue ? 'ring-2 ring-red-300 dark:ring-red-700' : ''
        }`} style={{ backgroundColor: goal.color || '#14b8a6' }}>
          {/* Brilho sutil no topo */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                {isCompleted ? <CheckCircle2 size={24} /> : <Target size={24} />}
              </div>
              <div>
                <h2 className="font-bold text-lg">{goal.name}</h2>
                <p className="text-white/70 text-xs flex items-center gap-1.5">
                  {isCompleted && <CheckCircle2 size={12} />}
                  {isPaused && <PauseCircle size={12} />}
                  {!isCompleted && !isPaused && <TrendingUp size={12} />}
                  {isCompleted ? 'Concluída 🎉' : isPaused ? 'Pausada' : 'Em progresso'}
                </p>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/70">{formatCurrency(Number(goal.current_amount))}</span>
                <span className="font-bold">{formatCurrency(Number(goal.target_amount))}</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${
                  isCompleted ? 'bg-emerald-300' : 'bg-white'
                }`} style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-bold">{progress.toFixed(0)}%</span>
              {goal.deadline && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-200' : 'text-white/70'}`}>
                  {isOverdue ? <AlertTriangle size={14} /> : <Calendar size={14} />}
                  {isOverdue ? `${Math.abs(daysLeft)} dias atrasado` : `${daysLeft} dias restantes`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleToggleStatus}
            className={`py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              isPaused
                ? 'bg-teal-700 text-white hover:bg-teal-800 shadow-lg shadow-teal-700/20'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50'
            }`}
          >
            {isPaused ? <Play size={14} /> : <PauseCircle size={14} />}
            {isPaused ? 'Reativar' : 'Pausar'}
          </button>
          <button
            onClick={openAdjustModal}
            className="py-3 bg-teal-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-teal-800 transition-colors active:scale-95 shadow-lg shadow-teal-700/20"
          >
            <Plus size={14} />
            Ajustar
          </button>
          <button
            onClick={() => router.push('/transactions/new?type=income')}
            className="py-3 bg-white dark:bg-slate-800 rounded-2xl font-bold text-xs border border-gray-100 dark:border-slate-700 flex items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors active:scale-95"
          >
            <ArrowUp size={14} className="text-emerald-500" />
            Transação
          </button>
        </div>

        {/* Informações */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 space-y-3">
          <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">Detalhes</h3>
          {goal.categories?.name && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Categoria vinculada</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{goal.categories.name}</span>
            </div>
          )}
          {goal.tags?.name && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Tag vinculada</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{goal.tags.name}</span>
            </div>
          )}
          {goal.accounts?.name && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Conta vinculada</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{goal.accounts.name}</span>
            </div>
          )}
          {goal.deadline && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Prazo</span>
              <span className={`font-medium flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
                {isOverdue && <AlertTriangle size={12} />}
                {format(new Date(goal.deadline), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
          )}
          {goal.notes && (
            <div className="pt-2 border-t border-gray-50 dark:border-slate-700">
              <p className="text-xs text-gray-400 mb-1">Observações</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{goal.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de ajuste manual (mantido funcional) */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdjustModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ajustar valor</h3>
              <button onClick={() => setShowAdjustModal(false)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Adicione um valor manual ao progresso da meta.</p>
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Valor</label>
              <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                <span className="text-gray-400 font-bold mr-2">R$</span>
                <input
                  type="text"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="bg-transparent w-full outline-none font-bold text-gray-800 dark:text-gray-200 text-lg"
                  placeholder="0,00"
                />
              </div>
            </div>
            <button
              onClick={handleSaveAdjust}
              disabled={adjustSaving || !adjustAmount}
              className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
            >
              {adjustSaving ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              {adjustSaving ? 'Salvando...' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}