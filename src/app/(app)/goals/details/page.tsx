'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle,
  ChevronLeft,
  Edit2,
  Image,
  Paperclip,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  X,
} from 'lucide-react'

import { useAuth } from '@/lib/hooks/useAuth'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useContext_ } from '@/components/ContextToggle'
import { useGoalById } from '@/hooks/useGoalById'
import { useGoalTransactions } from '@/hooks/useGoalTransactions'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import Skeleton from '@/components/Skeleton'

const GoalDetailSkeleton = () => (
  <div className="animate-pulse space-y-4 px-4 pt-6">
    <div className="mb-6 flex items-center justify-between">
      <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-slate-700" />
      <div className="h-5 w-32 rounded bg-gray-200 dark:bg-slate-700" />
      <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-slate-700" />
    </div>

    <div className="rounded-[28px] border border-gray-50 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
      <div className="mb-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-[18px] bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-gray-200 dark:bg-slate-700" />
          <div className="h-3 w-20 rounded bg-gray-100 dark:bg-slate-700/50" />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-[16px] bg-gray-100 p-3 dark:bg-slate-700"
          >
            <div className="mx-auto mb-2 h-3 w-12 rounded bg-gray-200 dark:bg-slate-600" />
            <div className="mx-auto h-5 w-16 rounded bg-gray-200 dark:bg-slate-600" />
          </div>
        ))}
      </div>

      <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div className="h-full w-2/3 rounded-full bg-gray-200 dark:bg-slate-600" />
      </div>
      <div className="ml-auto h-3 w-16 rounded bg-gray-200 dark:bg-slate-700" />
    </div>

    <div className="rounded-[28px] border border-gray-50 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
      <div className="mb-4 h-5 w-40 rounded bg-gray-200 dark:bg-slate-700" />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-gray-50 py-3 last:border-b-0 dark:border-slate-700"
        >
          <div className="h-9 w-9 rounded-lg bg-gray-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded bg-gray-200 dark:bg-slate-700" />
            <div className="h-2.5 w-1/2 rounded bg-gray-100 dark:bg-slate-700/50" />
          </div>
          <div className="h-4 w-16 rounded bg-gray-200 dark:bg-slate-700" />
        </div>
      ))}
    </div>
  </div>
)

function SurfaceCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[28px] border border-black/5 bg-white/95 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-slate-800/95 dark:shadow-none ${className}`}
    >
      {children}
    </section>
  )
}

function HeaderBar({
  title,
  onBack,
  onEdit,
  onDelete,
}: {
  title: string
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-full p-2 text-gray-800 transition-transform active:scale-95 dark:text-gray-200"
            aria-label="Voltar"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
              Goal details
            </p>
            <h1 className="max-w-[180px] truncate text-[18px] font-bold text-gray-800 dark:text-gray-100">
              {title}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="rounded-full bg-gray-50 p-2.5 text-teal-700 transition-all active:scale-95 hover:bg-teal-50 dark:bg-slate-800 dark:text-teal-400 dark:hover:bg-teal-900/30"
            aria-label="Editar meta"
          >
            <Edit2 size={18} />
          </button>

          <button
            onClick={onDelete}
            className="rounded-full bg-red-50 p-2.5 text-red-500 transition-all active:scale-95 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20"
            aria-label="Excluir meta"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusChip({
  isCompleted,
  isOverdue,
  daysLeft,
}: {
  isCompleted: boolean
  isOverdue: boolean
  daysLeft: number
}) {
  return (
    <div className="mb-2 flex justify-center">
      <span
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold shadow-sm ${
          isCompleted
            ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-900/30'
            : isOverdue
            ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-900/30'
            : 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-800 dark:bg-teal-900/30'
        }`}
      >
        {isCompleted && <CheckCircle size={12} />}
        {isOverdue && <AlertTriangle size={12} />}
        {isCompleted ? 'Concluída' : isOverdue ? 'Atrasada' : `${daysLeft} dias restantes`}
      </span>
    </div>
  )
}

function StatBlock({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string
  tone?: 'neutral' | 'success' | 'warning'
}) {
  const toneMap = {
    neutral:
      'bg-gray-50 dark:bg-slate-700/40 border-gray-100 dark:border-slate-700/50 text-gray-800 dark:text-gray-200 label-gray-400 dark:label-gray-500',
    success:
      'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 label-emerald-600/70',
    warning:
      'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20 text-orange-600 label-orange-600/70',
  }

  return (
    <div
      className={`rounded-[20px] border p-3.5 text-center ${
        tone === 'success'
          ? 'border-emerald-100 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10'
          : tone === 'warning'
          ? 'border-orange-100 bg-orange-50 dark:border-orange-500/20 dark:bg-orange-500/10'
          : 'border-gray-100 bg-gray-50 dark:border-slate-700/50 dark:bg-slate-700/40'
      }`}
    >
      <p
        className={`mb-1 text-[10px] font-bold uppercase tracking-widest ${
          tone === 'success'
            ? 'text-emerald-600/70'
            : tone === 'warning'
            ? 'text-orange-600/70'
            : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        {label}
      </p>
      <p
        className={`text-[15px] font-black ${
          tone === 'success'
            ? 'text-emerald-600'
            : tone === 'warning'
            ? 'text-orange-600'
            : 'text-gray-800 dark:text-gray-200'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function ContributionModal({
  open,
  contribAmount,
  contribDate,
  contribNote,
  contribAmountNum,
  onClose,
  onAmountChange,
  onDateChange,
  onNoteChange,
  onConfirm,
  vibrate,
}: {
  open: boolean
  contribAmount: string
  contribDate: string
  contribNote: string
  contribAmountNum: number
  onClose: () => void
  onAmountChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDateChange: (value: string) => void
  onNoteChange: (value: string) => void
  onConfirm: () => void
  vibrate: (pattern?: number | number[]) => void
}) {
  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />

      <div
        className="relative w-full max-w-lg rounded-t-[32px] bg-white p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">
            Registrar Contribuição
          </h3>
          <button
            onClick={() => {
              vibrate([5])
              onClose()
            }}
            className="rounded-full bg-gray-100 p-2 text-gray-400 active:scale-95 dark:bg-slate-700"
            aria-label="Fechar modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6 space-y-4">
          <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 dark:border-slate-700/50 dark:bg-slate-700/40">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-gray-500">
              Valor
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[18px] font-medium text-gray-400">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={contribAmount}
                onChange={onAmountChange}
                className="w-full bg-transparent text-[24px] font-black text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
                placeholder="0,00"
                autoFocus
              />
            </div>
          </div>

          <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 dark:border-slate-700/50 dark:bg-slate-700/40">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-gray-500">
              Data
            </label>
            <input
              type="date"
              value={contribDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full bg-transparent text-[15px] font-bold text-gray-800 outline-none dark:text-gray-100"
            />
          </div>

          <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 dark:border-slate-700/50 dark:bg-slate-700/40">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-gray-500">
              Observação (Opcional)
            </label>
            <input
              type="text"
              value={contribNote}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Ex: Economia da semana"
              className="w-full bg-transparent text-[15px] font-bold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
            />
          </div>
        </div>

        <button
          onClick={() => {
            vibrate([10, 50])
            onConfirm()
          }}
          disabled={contribAmountNum <= 0}
          className="w-full rounded-[24px] bg-teal-600 py-4 text-[16px] font-bold text-white shadow-lg shadow-teal-600/30 transition-transform active:scale-[0.98] disabled:opacity-50 hover:bg-teal-700"
        >
          Confirmar Contribuição
        </button>
      </div>
    </div>,
    document.body
  )
}

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

  const [refreshing] = useState(false)
  const [showContributionModal, setShowContributionModal] = useState(false)
  const [contribAmount, setContribAmount] = useState('')
  const [contribAmountNum, setContribAmountNum] = useState(0)
  const [contribDate, setContribDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [contribNote, setContribNote] = useState('')

  const { data: goal, loading: goalsLoading, notFound } = useGoalById(id)
  const { data: transactions, loading: txLoading } = useGoalTransactions(id)

  const loading = goalsLoading || txLoading

  const handleDelete = async () => {
    if (!user) return

    vibrate([10, 50])

    if (
      !confirm(
        'Excluir esta meta? As contribuições vinculadas não serão apagadas, apenas perderão a categoria da meta.'
      )
    ) {
      return
    }

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
    setContribAmount(
      num.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    )
  }

  const getAttachmentIcon = (url: string | null) => {
  if (!url) return null
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
  if (isImage) return <Image size={12} className="text-blue-500 shrink-0" />
  return <Paperclip size={12} className="text-gray-500 shrink-0" />
}

    return <Paperclip size={12} className="shrink-0 text-gray-500" />
  }

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const saved = useMemo(() => {
    return (transactions || [])
      .filter((tx: any) => tx.type === 'income' && tx.status === 'done')
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)
  }, [transactions])

  if (loading && !goal) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-gray-50 transition-colors duration-300 dark:bg-slate-900">
        <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />
        </div>
        <GoalDetailSkeleton />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-gray-50 px-4 dark:bg-slate-900">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
          <Target size={32} className="text-red-500" />
        </div>

        <h2 className="mb-2 text-xl font-bold text-gray-800 dark:text-gray-200">
          Meta não encontrada
        </h2>

        <p className="mb-6 max-w-xs text-center text-sm text-gray-500 dark:text-gray-400">
          A meta que você está tentando acessar pode ter sido excluída ou você não tem permissão.
        </p>

        <button
          onClick={() => router.push('/goals')}
          className="rounded-full bg-teal-600 px-6 py-3 font-semibold text-white transition-colors active:scale-95 hover:bg-teal-700"
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  if (!goal) return null

  const IconComp = getDynamicIcon(goal.icon || 'target')
  const remaining = Number(goal.target_amount) - saved
  const percent =
    Number(goal.target_amount) > 0
      ? (saved / Number(goal.target_amount)) * 100
      : 0
  const isCompleted = saved >= Number(goal.target_amount)
  const daysLeft = differenceInDays(new Date(goal.deadline), new Date())
  const isOverdue = daysLeft < 0 && !isCompleted

  return (
    <div className="mx-auto min-h-screen max-w-md bg-gray-50 pb-24 font-sans transition-colors duration-300 dark:bg-slate-900">
      {refreshing && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.1)] animate-in slide-in-from-top-2 duration-300 dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-bold text-teal-600">
              Atualizando...
            </span>
          </div>
        </div>
      )}

      <HeaderBar
        title={goal.name}
        onBack={() => {
          vibrate([5])
          router.back()
        }}
        onEdit={() => {
          vibrate([5])
          router.push(`/goals/new?edit=${goal.id}`)
        }}
        onDelete={handleDelete}
      />

      <div className="space-y-4 px-4 pt-6 animate-in fade-in duration-300">
        <StatusChip
          isCompleted={isCompleted}
          isOverdue={isOverdue}
          daysLeft={daysLeft}
        />

        <SurfaceCard className="overflow-hidden p-6">
          <div
            className="relative mb-5 overflow-hidden rounded-[24px] p-5"
            style={{
              background: `linear-gradient(135deg, ${goal.color}15, ${goal.color}08)`,
            }}
          >
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] shadow-sm"
                style={{
                  backgroundColor: `${goal.color}20`,
                  color: goal.color,
                }}
              >
                <IconComp size={24} />
              </div>

              <div className="min-w-0">
                <p className="truncate text-[18px] font-black leading-tight text-gray-800 dark:text-gray-100">
                  {goal.name}
                </p>
                <p className="mt-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  {goal.category ? `Meta para ${goal.category}` : 'Meta geral'}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            <StatBlock
              label="Meta"
              value={formatCurrency(Number(goal.target_amount))}
              tone="neutral"
            />
            <StatBlock
              label="Guardado"
              value={formatCurrency(saved)}
              tone={saved > 0 ? 'success' : 'neutral'}
            />
            <StatBlock
              label={remaining > 0 ? 'Falta' : 'Status'}
              value={
                remaining > 0
                  ? formatCurrency(Math.abs(remaining))
                  : '✅ Completo'
              }
              tone={remaining > 0 ? 'warning' : 'success'}
            />
          </div>

          <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-gray-100 shadow-inner dark:bg-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                isCompleted
                  ? 'bg-emerald-500'
                  : isOverdue
                  ? 'bg-red-500'
                  : 'bg-teal-500'
              }`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
              Prazo:{' '}
              {goal.deadline
                ? format(new Date(goal.deadline), "dd 'de' MMM yyyy", {
                    locale: ptBR,
                  })
                : '—'}
            </p>

            <p
              className={`text-[12px] font-bold ${
                isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {percent.toFixed(1)}% concluído
            </p>
          </div>
        </SurfaceCard>

        {!isCompleted && (
          <button
            onClick={() => {
              vibrate([5])
              setShowContributionModal(true)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-teal-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-teal-600/30 transition-transform active:scale-[0.98] hover:bg-teal-700"
          >
            <Plus size={18} />
            Registrar Contribuição
          </button>
        )}

        <SurfaceCard className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-gray-800 dark:text-gray-100">
              Histórico de Contribuições
            </h3>
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
              {transactions?.length || 0} lançamentos
            </span>
          </div>

          {txLoading ? (
            <div className="flex justify-center py-6">
              <RefreshCw size={24} className="animate-spin text-teal-500" />
            </div>
          ) : !transactions || transactions.length === 0 ? (
            <p className="py-6 text-center text-[13px] font-medium text-gray-400">
              Nenhuma contribuição registrada.
            </p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700/70">
              {transactions.map((tx: any) => {
                const IconTx = tx.type === 'income' ? ArrowUp : ArrowDown
                const isIncome = tx.type === 'income'
                const attachmentIcon = getAttachmentIcon(tx.receipt_url)

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ${
                          isIncome
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-red-100 text-red-500 dark:bg-red-900/30'
                        }`}
                      >
                        <IconTx size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <p className="truncate text-[14px] font-bold text-gray-800 dark:text-gray-200">
                            {tx.description || 'Contribuição'}
                          </p>
                          {attachmentIcon && (
                            <span className="shrink-0">{attachmentIcon}</span>
                          )}
                        </div>

                        <p className="mt-0.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                          {format(new Date(tx.date), "dd 'de' MMM yyyy", {
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>

                    <p
                      className={`flex-shrink-0 text-[15px] font-black ${
                        isIncome ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {isIncome ? '+' : '-'} {formatCurrency(Number(tx.amount) || 0)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </SurfaceCard>
      </div>

      <ContributionModal
        open={showContributionModal}
        contribAmount={contribAmount}
        contribDate={contribDate}
        contribNote={contribNote}
        contribAmountNum={contribAmountNum}
        onClose={() => setShowContributionModal(false)}
        onAmountChange={handleContribAmountChange}
        onDateChange={setContribDate}
        onNoteChange={setContribNote}
        onConfirm={handleContribution}
        vibrate={vibrate}
      />
    </div>
  )
}

export default function GoalDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] flex-col bg-slate-50 dark:bg-slate-950">
          <div className="flex-1 px-4 pt-4">
            <Skeleton count={4} />
          </div>
        </div>
      }
    >
      <GoalDetailContent />
    </Suspense>
  )
}