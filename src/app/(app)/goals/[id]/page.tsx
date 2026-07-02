'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Loader2, Check, Trash2, X, Calendar, RefreshCw,
  Target, TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle2,
  PauseCircle, Edit3, Plus
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { formatCurrency } from '@/lib/utils'

// ============================================================
// SKELETON LOADER (CORES SUAVES)
// ============================================================
const GoalDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6 space-y-4">
    {/* Card principal */}
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-28 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
        <div className="h-7 w-24 bg-gray-200 dark:bg-slate-700 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-3 bg-gray-100 dark:bg-slate-700 text-center">
          <div className="h-3 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
          <div className="h-6 w-24 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
        </div>
        <div className="rounded-xl p-3 bg-gray-100 dark:bg-slate-700 text-center">
          <div className="h-3 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
          <div className="h-6 w-24 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
        </div>
      </div>
      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden mb-2">
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-1/2" />
      </div>
      <div className="h-3 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
    </div>

    {/* Histórico */}
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl mb-2">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-slate-600 rounded" />
            <div className="h-3 w-32 bg-gray-100 dark:bg-slate-600/50 rounded" />
          </div>
          <div className="w-6 h-6 bg-gray-200 dark:bg-slate-600 rounded" />
        </div>
      ))}
    </div>
  </div>
)

export default function GoalDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [goal, setGoal] = useState<any>(null)
  const [contributions, setContributions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Modal de contribuição
  const [showContributionModal, setShowContributionModal] = useState(false)
  const [contribAmount, setContribAmount] = useState('0,00')
  const [contribAmountNum, setContribAmountNum] = useState(0)
  const [contribDate, setContribDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [contribNote, setContribNote] = useState('')

  // Modal de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false)

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

  const loadData = useCallback(async () => {
    if (!id || !user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    const { data: goalData } = await supabase
      .from('goals')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!goalData) {
      router.push('/goals')
      return
    }

    setGoal(goalData)

    // Buscar contribuições (transações vinculadas à meta)
    const { data: txData } = await supabase
      .from('transactions')
      .select('*')
      .eq('goal_id', id)
      .eq('user_id', user.id)
      .order('date', { ascending: false })

    setContributions(Array.isArray(txData) ? txData : [])
    setLoading(false)
    setLoadingPulse(false)
  }, [id, user])

  useEffect(() => { loadData() }, [loadData])

  const handleContribAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    if (!digits) {
      setContribAmount('0,00')
      setContribAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setContribAmountNum(num)
    setContribAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  const handleContribution = async () => {
    if (!user?.id || contribAmountNum <= 0) return
    const remaining = Number(goal.target_amount) - Number(goal.current_amount || 0)
    if (contribAmountNum > remaining) {
      showToast('Valor excede o restante da meta.', 'warning')
      return
    }

    setSaving(true)

    try {
      // 1. Criar transação de receita
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          context: context,
          type: 'income',
          amount: contribAmountNum,
          description: contribNote || `Contribuição para meta: ${goal.name}`,
          date: contribDate,
          status: 'done',
          affects_balance: true,
          goal_id: id,
        })
        .select()
        .single()

      if (txError) throw txError

      // 2. Atualizar meta
      const newCurrent = Number(goal.current_amount || 0) + contribAmountNum
      const newStatus = newCurrent >= Number(goal.target_amount) ? 'completed' : 'active'

      await supabase
        .from('goals')
        .update({
          current_amount: newCurrent,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      showToast('Contribuição registrada com sucesso!', 'success')
      setShowContributionModal(false)
      setContribAmount('0,00')
      setContribAmountNum(0)
      setContribNote('')
      loadData()
    } catch (err: any) {
      showToast(`Erro ao registrar contribuição: ${err.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    setSaving(true)
    try {
      // Opcional: remover vínculo das transações ou deletar tudo
      await supabase.from('goals').delete().eq('id', id)
      showToast('Meta excluída.', 'info')
      router.push('/goals')
    } catch (err: any) {
      showToast(`Erro ao excluir: ${err.message}`, 'error')
    } finally {
      setSaving(false)
      setShowDeleteModal(false)
    }
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

  // Skeleton enquanto carrega
  if (loading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans transition-colors duration-300">
        <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-50 dark:border-slate-700">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-10" />
        </div>
        <GoalDetailSkeleton />
      </div>
    )
  }

  if (!goal) return null

  const IconComp = getDynamicIcon(goal.icon || 'target')
  const progress = Number(goal.target_amount) > 0
    ? (Number(goal.current_amount || 0) / Number(goal.target_amount)) * 100
    : 0
  const statusConfig = getStatusConfig(goal.status)
  const progressColor = getProgressColor(goal.status)
  const isCompleted = goal.status === 'completed'
  const isActive = goal.status === 'active'
  const remaining = Math.max(Number(goal.target_amount) - Number(goal.current_amount || 0), 0)

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-32 font-sans transition-colors duration-300">
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
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-50 dark:border-slate-700">
        <button onClick={() => router.push('/goals')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <statusConfig.icon size={18} className={statusConfig.color.split(' ')[0]} />
          <h1 className="font-bold text-[17px] text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
            {goal.name || 'Meta'}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/goals/${id}/edit`)}
            className="p-2 text-gray-400 hover:text-teal-600 transition-colors"
          >
            <Edit3 size={18} />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 animate-in fade-in duration-300">
        {/* Card Principal */}
        <div className={`bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border ${
          isCompleted ? 'border-emerald-200 dark:border-emerald-800' :
          goal.status === 'paused' ? 'border-gray-200 dark:border-gray-700' :
          'border-gray-50 dark:border-slate-700'
        }`}>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${goal.color || '#14b8a6'}20`, color: goal.color || '#14b8a6' }}>
              <IconComp size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-[17px] text-gray-800 dark:text-gray-200 truncate">
                {goal.name}
              </h2>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {formatCurrency(Number(goal.current_amount || 0))} / {formatCurrency(Number(goal.target_amount))}
                {goal.deadline && (
                  <> • {format(new Date(goal.deadline), "dd 'de' MMM yyyy", { locale: ptBR })}</>
                )}
              </p>
            </div>
            <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 whitespace-nowrap ${statusConfig.color}`}>
              <statusConfig.icon size={12} />
              {statusConfig.label}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Meta</p>
              <p className="text-[18px] font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Number(goal.target_amount))}</p>
            </div>
            <div className={`text-center rounded-xl p-3 ${
              isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/20' :
              goal.status === 'paused' ? 'bg-gray-50 dark:bg-slate-700' :
              'bg-orange-50 dark:bg-orange-900/20'
            }`}>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Restante</p>
              <p className={`text-[18px] font-bold ${
                isCompleted ? 'text-emerald-600' :
                goal.status === 'paused' ? 'text-gray-500' :
                'text-orange-600'
              }`}>{formatCurrency(remaining)}</p>
            </div>
          </div>

          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-2">
            <div className={`h-full rounded-full transition-all duration-700 ${progressColor}`} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>

          <div className="flex justify-between text-[11px]">
            <span className="text-gray-400 dark:text-gray-500 font-medium">{Math.min(progress, 100).toFixed(0)}% alcançado</span>
            <span className="text-gray-400 dark:text-gray-500 font-medium">
              {formatCurrency(Number(goal.current_amount || 0))} / {formatCurrency(Number(goal.target_amount))}
            </span>
          </div>
        </div>

        {/* Botão de contribuição (se ativa) */}
        {isActive && remaining > 0 && (
          <button
            onClick={() => setShowContributionModal(true)}
            className="w-full bg-teal-700 text-white py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20"
          >
            <Plus size={16} />
            Registrar Contribuição
          </button>
        )}

        {/* Histórico de contribuições */}
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-gray-400" />
            Histórico de Contribuições
          </h3>
          {contributions.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">
              Nenhuma contribuição registrada.
            </p>
          ) : (
            <div className="space-y-2">
              {contributions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-700 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-[13px] font-bold text-emerald-600">
                        + {formatCurrency(Number(tx.amount) || 0)}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {format(new Date(tx.date + 'T12:00:00'), "dd 'de' MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  {tx.description && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 max-w-[120px] truncate">
                      {tx.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Descrição (se houver) */}
        {goal.description && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
            <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Target size={18} className="text-gray-400" />
              Descrição
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">{goal.description}</p>
          </div>
        )}
      </div>

      {/* Modal de Contribuição */}
      {showContributionModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowContributionModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Registrar Contribuição</h3>
              <button onClick={() => setShowContributionModal(false)} className="text-gray-400 p-2 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Valor contribuído</label>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <span className="text-gray-400 dark:text-gray-500 font-bold">R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={contribAmount}
                    onChange={handleContribAmountChange}
                    className="bg-transparent text-lg font-bold text-gray-800 dark:text-gray-200 outline-none w-full"
                    placeholder="0,00"
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Restante para meta: {formatCurrency(remaining)}</p>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Data da contribuição</label>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
                  <Calendar size={16} className="text-gray-400" />
                  <input
                    type="date"
                    value={contribDate}
                    onChange={e => setContribDate(e.target.value)}
                    className="bg-transparent text-sm font-bold text-gray-800 dark:text-gray-200 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2 block">Observação (opcional)</label>
                <input
                  type="text"
                  value={contribNote}
                  onChange={e => setContribNote(e.target.value)}
                  placeholder="Ex: Economia do mês"
                  className="w-full bg-gray-50 dark:bg-slate-700 rounded-xl p-3 text-sm outline-none text-gray-800 dark:text-gray-200"
                />
              </div>

              <button
                onClick={handleContribution}
                disabled={saving || contribAmountNum <= 0}
                className="w-full bg-teal-700 text-white py-4 rounded-xl font-bold disabled:opacity-50 hover:bg-teal-800 transition-colors"
              >
                {saving ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Confirmar Contribuição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-[90%] max-w-sm rounded-2xl p-6 animate-in fade-in-zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2 text-center">Excluir Meta?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              Essa ação não pode ser desfeita. As contribuições vinculadas permanecerão como transações.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}