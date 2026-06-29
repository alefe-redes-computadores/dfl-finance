'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  ChevronLeft, Edit3, Trash2, Loader2, Target,
  TrendingUp, Calendar, CheckCircle2, PauseCircle, Plus, X, Check
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'

export default function GoalDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [goal, setGoal] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Modal de ajuste manual
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustSaving, setAdjustSaving] = useState(false)

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  if (!goal) return null

  const progress = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100)
  const IconComp = getDynamicIcon(goal.icon || 'target')
  const daysLeft = goal.deadline ? differenceInDays(new Date(goal.deadline), new Date()) : null
  const isOverdue = daysLeft !== null && daysLeft < 0

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/goals')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100 truncate">{goal.name}</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(`/goals/${goal.id}/edit`)} className="p-2 text-gray-400 hover:text-teal-600">
              <Edit3 size={18} />
            </button>
            <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Card principal */}
        <div className="rounded-2xl p-5 text-white shadow-lg" style={{ backgroundColor: goal.color || '#14b8a6' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Target size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{goal.name}</h2>
              <p className="text-white/70 text-xs">
                {goal.status === 'completed' ? 'Concluída 🎉' : goal.status === 'paused' ? 'Pausada' : 'Em progresso'}
              </p>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-white/70">{formatCurrency(Number(goal.current_amount))}</span>
              <span className="font-bold">{formatCurrency(Number(goal.target_amount))}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">{progress.toFixed(0)}%</span>
            {goal.deadline && (
              <span className="text-white/70">
                {isOverdue ? `${Math.abs(daysLeft)} dias atrasado` : `${daysLeft} dias restantes`}
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleToggleStatus}
            className={`py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
              goal.status === 'paused'
                ? 'bg-teal-700 text-white hover:bg-teal-800'
                : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 border border-amber-200'
            }`}
          >
            {goal.status === 'paused' ? <TrendingUp size={14} /> : <PauseCircle size={14} />}
            {goal.status === 'paused' ? 'Reativar' : 'Pausar'}
          </button>
          <button
            onClick={openAdjustModal}
            className="py-3 bg-teal-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-teal-800 transition-colors"
          >
            <Plus size={14} />
            Ajustar
          </button>
          <button
            onClick={() => router.push('/transactions/new?type=income')}
            className="py-3 bg-white dark:bg-slate-800 rounded-2xl font-bold text-xs border border-gray-100 dark:border-slate-700 flex items-center justify-center gap-1.5 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <Plus size={14} />
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
              <span className={`font-medium ${isOverdue ? 'text-red-500' : 'text-gray-800 dark:text-gray-200'}`}>
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

      {/* Modal de ajuste manual */}
      {showAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setShowAdjustModal(false)}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Ajustar valor</h3>
              <button onClick={() => setShowAdjustModal(false)} className="p-1 text-gray-400"><X size={20} /></button>
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
              className="w-full bg-teal-700 text-white py-3 rounded-xl font-bold hover:bg-teal-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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