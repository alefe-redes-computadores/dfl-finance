'use client'

import { useEffect, useState, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom' // ✅ ADICIONADO
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Edit2, Trash2, AlertTriangle, CheckCircle, Plus, RefreshCw,
  ArrowUp, ArrowDown, X, Image, Paperclip
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import Skeleton from '@/components/Skeleton'

const GoalDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6 space-y-4">
    <div className="flex items-center justify-between mb-6">
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-[18px] bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[16px] p-3 bg-gray-100 dark:bg-slate-700">
            <div className="h-3 w-12 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
          </div>
        ))}
      </div>

      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
      </div>
      <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded ml-auto" />
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
      <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50 dark:border-slate-700 last:border-b-0">
          <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-2.5 w-1/2 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
          <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  </div>
)

function GoalDetailContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') as string
  const router = useRouter()
  const { user } = useAuth()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { safeDelete, safeAdd } = useSafeDb()

  const [refreshing, setRefreshing] = useState(false)
  const [showContributionModal, setShowContributionModal] = useState(false)
  const [contribAmount, setContribAmount] = useState('')
  const [contribAmountNum, setContribAmountNum] = useState(0)
  const [contribDate, setContribDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [contribNote, setContribNote] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const { data: goals, loading: goalsLoading, reload: reloadGoals } = useLocalData({
    table: 'goals' as any,
    filters: { id: id as string, context: effectiveContext },
  })

  const { data: allTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { goal_id: id as string, context: effectiveContext },
  })

  const goal = useMemo(() => goals?.find((g: any) => g.id === id), [goals, id])

  const transactions = useMemo(() => {
    if (!allTransactions || !goal) return []
    return allTransactions
      .filter((tx: any) => tx.goal_id === goal.id)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [allTransactions, goal])

  const saved = useMemo(() => {
    return transactions
      .filter((tx: any) => tx.type === 'income' && tx.status === 'done')
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)
  }, [transactions])

  const loading = goalsLoading || txLoading

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

  const handleDelete = async () => {
    if (!user) return
    vibrate([10, 50])
    if (!confirm('Excluir esta meta? As contribuições vinculadas não serão apagadas, apenas perderão a categoria da meta.')) return

    try {
      const res = await safeDelete('goals', id as string)
      if (!res.success) throw new Error(res.error)
      success()
      showToast('🗑️ Meta excluída.', 'success')
      router.push('/goals')
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro ao excluir: ${err.message}`, 'error')
    }
  }

  const handleContribution = async () => {
    if (!user?.id || contribAmountNum <= 0 || !goal) {
      errorHaptic()
      showToast('⚠️ Digite um valor válido.', 'warning')
      return
    }

    try {
      const txId = crypto.randomUUID()
      const txPayload = {
        id: txId,
        user_id: user.id,
        context: effectiveContext || 'dfl',
        type: 'income',
        amount: contribAmountNum,
        description: contribNote || `Contribuição para ${goal.name}`,
        date: contribDate,
        status: 'done',
        affects_balance: true,
        goal_id: id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }

      const res = await safeAdd('transactions', txPayload)
      if (!res.success) throw new Error(res.error)

      success()
      showToast('✅ Contribuição registrada!', 'success')
      setShowContributionModal(false)
      setContribAmount('')
      setContribAmountNum(0)
      setContribNote('')
      reloadTransactions()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro ao registrar: ${err.message}`, 'error')
    }
  }

  const handleContribAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/D/g, '')
    if (!digits) {
      setContribAmount('')
      setContribAmountNum(0)
      return
    }
    const num = parseFloat(digits) / 100
    setContribAmountNum(num)
    setContribAmount(num.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
  }

  // 🔥 CORRIGIDO: regex com (\?|$) e ponto escapado
  const getAttachmentIcon = (url: string | null) => {
    if (!url) return null
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
    if (isImage) return <Image size={12} className="text-blue-500 shrink-0" />
    return <Paperclip size={12} className="text-gray-500 shrink-0" />
  }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading && !goal) return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 px-4 pt-6 pb-4">
        <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
      </div>
      <GoalDetailSkeleton />
    </div>
  )

  if (!loading && !goal) {
    router.push('/goals')
    return null
  }

  const IconComp = getDynamicIcon(goal.icon || 'target')
  const remaining = Number(goal.target_amount) - saved
  const percent = Number(goal.target_amount) > 0 ? (saved / Number(goal.target_amount)) * 100 : 0
  const isCompleted = saved >= Number(goal.target_amount)
  const daysLeft = differenceInDays(new Date(goal.deadline), new Date())
  const isOverdue = daysLeft < 0 && !isCompleted

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 font-sans transition-colors duration-300">
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-slate-800 shadow-sm px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => { vibrate([5]); router.back(); }} className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform">
              <ChevronLeft size={24} />
            </button>
            <h1 className="text-[18px] font-bold text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
              {goal.name}
            </h1>
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => { vibrate([5]); router.push(`/goals/new?edit=${goal.id}`); }} className="p-2.5 rounded-full bg-gray-50 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-900/30 text-teal-700 dark:text-teal-400 active:scale-95 transition-all">
              <Edit2 size={18} />
            </button>
            <button onClick={handleDelete} className="p-2.5 rounded-full bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 active:scale-95 transition-all">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-4 animate-in fade-in duration-300">
        <div className="flex justify-center mb-2">
          <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border ${isCompleted ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800' : isOverdue ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:border-red-800' : 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:border-teal-800'}`}>
            {isCompleted && <CheckCircle size={12} />}
            {isOverdue && <AlertTriangle size={12} />}
            {isCompleted ? 'Concluída' : isOverdue ? 'Atrasada' : `${daysLeft} dias restantes`}
          </span>
        </div>

        <section className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <div className="flex items-center gap-4 mb-6 mt-1">
            <div className="w-14 h-14 rounded-[18px] flex items-center justify-center shadow-sm shrink-0" style={{ backgroundColor: `${goal.color}15`, color: goal.color }}>
              <IconComp size={24} />
            </div>
            <div className="min-w-0">
              <p className="font-black text-[18px] text-gray-800 dark:text-gray-100 leading-tight truncate">{goal.name}</p>
              <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-1">
                {goal.category ? `Meta para ${goal.category}` : 'Meta geral'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="text-center bg-gray-50 dark:bg-slate-700/40 rounded-[20px] p-3.5 border border-gray-100 dark:border-slate-700/50">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Meta</p>
              <p className="text-[15px] font-black text-gray-800 dark:text-gray-200">{formatCurrency(Number(goal.target_amount))}</p>
            </div>
            <div className={`text-center rounded-[20px] p-3.5 border ${saved > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' : 'bg-gray-50 dark:bg-slate-700/40 border-gray-100 dark:border-slate-700/50'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${saved > 0 ? 'text-emerald-600/70' : 'text-gray-400 dark:text-gray-500'}`}>Guardado</p>
              <p className={`text-[15px] font-black ${saved > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>{formatCurrency(saved)}</p>
            </div>
            <div className={`text-center rounded-[20px] p-3.5 border ${remaining > 0 ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${remaining > 0 ? 'text-orange-600/70' : 'text-emerald-600/70'}`}>{remaining > 0 ? 'Falta' : 'Status'}</p>
              <p className={`text-[15px] font-black ${remaining > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>{remaining > 0 ? formatCurrency(Math.abs(remaining)) : '✅ Completo'}</p>
            </div>
          </div>

          <div className="w-full bg-gray-100 dark:bg-slate-700/50 rounded-full h-3 overflow-hidden mb-2 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <p className={`text-[12px] font-bold text-right ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {percent.toFixed(1)}% concluído
          </p>
        </section>

        {!isCompleted && (
          <button
            onClick={() => { vibrate([5]); setShowContributionModal(true); }}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[15px] shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Registrar Contribuição
          </button>
        )}

        <section className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100">Histórico de Contribuições</h3>
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">{transactions.length} lançamentos</span>
          </div>

          {transactions.length === 0 ? (
            <p className="text-center text-[13px] font-medium text-gray-400 py-6">Nenhuma contribuição registrada.</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700/70">
              {transactions.map((tx: any) => {
                const IconTx = tx.type === 'income' ? ArrowUp : ArrowDown
                const isIncome = tx.type === 'income'
                const attachmentIcon = getAttachmentIcon(tx.receipt_url)

                return (
                  <div key={tx.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
                        <IconTx size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">
                            {tx.description || 'Contribuição'}
                          </p>
                          {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
                        </div>
                        <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                          {format(new Date(tx.date), "dd 'de' MMM yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <p className={`text-[15px] font-black flex-shrink-0 ${isIncome ? 'text-emerald-600' : 'text-red-500'}`}>
                      {isIncome ? '+' : '-'} {formatCurrency(Number(tx.amount) || 0)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* ✅ MODAL DE CONTRIBUIÇÃO COM PORTAL */}
      {showContributionModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end justify-center" onClick={() => setShowContributionModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div
            className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Registrar Contribuição</h3>
              <button onClick={() => { vibrate([5]); setShowContributionModal(false); }} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Valor</label>
                <div className="flex items-center gap-2">
                  <span className="text-[18px] text-gray-400 font-medium">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={contribAmount}
                    onChange={handleContribAmountChange}
                    className="w-full bg-transparent text-[24px] font-black text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Data</label>
                <input
                  type="date"
                  value={contribDate}
                  onChange={e => setContribDate(e.target.value)}
                  className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-100 outline-none"
                />
              </div>

              <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[20px] p-4">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 block">Observação (Opcional)</label>
                <input
                  type="text"
                  value={contribNote}
                  onChange={e => setContribNote(e.target.value)}
                  placeholder="Ex: Economia da semana"
                  className="w-full bg-transparent text-[15px] font-bold text-gray-800 dark:text-gray-100 outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
                />
              </div>
            </div>

            <button
              onClick={() => { vibrate([10, 50]); handleContribution(); }}
              disabled={contribAmountNum <= 0}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] disabled:opacity-50 shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-transform"
            >
              Confirmar Contribuição
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function GoalDetailPage() {
  return (
    <Suspense fallback={<div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950"><div className="flex-1 px-4 pt-4"><Skeleton count={4} /></div></div>}>
      <GoalDetailContent />
    </Suspense>
  )
}