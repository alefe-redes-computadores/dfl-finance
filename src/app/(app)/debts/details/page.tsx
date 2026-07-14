'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft,
  Edit2,
  Loader2,
  Check,
  Trash2,
  X,
  Wallet,
  Calendar,
  MessageCircle,
  RefreshCw,
  AlertTriangle,
  Clock3,
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { formatCurrency } from '@/lib/utils'
import { useLocalData } from '@/hooks/useLocalData'
import { useDebtById } from '@/hooks/useDebtById'
import { db } from '@/lib/db'
import { useSafeDb } from '@/hooks/useSafeDb'
import MoneyInput from '@/components/MoneyInput'

type DebtStatus = 'pending' | 'partial' | 'paid'

interface Debt {
  id: string
  person_name: string
  total_amount: number
  paid_amount?: number
  description?: string
  due_date?: string
  status?: DebtStatus
  context?: string
  icon?: string
  color?: string
  account_id?: string | null
  phone?: string
  whatsapp?: string
}

interface Account {
  id: string
  name: string
  balance?: number
  color?: string
  context?: string
}

interface PaymentTransaction {
  id: string
  amount: number
  date: string
  description?: string
  account_id?: string | null
  debt_id?: string
}

function SectionCard({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={`rounded-[28px] border border-gray-100 bg-white shadow-sm dark:border-slate-700/50 dark:bg-slate-800 ${className}`}
    >
      {children}
    </section>
  )
}

function InfoRow({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-600 dark:text-emerald-400'
      : tone === 'warning'
      ? 'text-orange-600 dark:text-orange-400'
      : 'text-gray-800 dark:text-gray-100'

  return (
    <div className="rounded-[20px] bg-gray-50 px-4 py-3 dark:bg-slate-700/40">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className={`text-[15px] font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function AppBottomSheet({
  open,
  onClose,
  title,
  children,
  zIndex = 600,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  zIndex?: number
}) {
  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex }}
      onClick={onClose}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-lg rounded-t-[32px] bg-white p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:bg-slate-800 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-full bg-gray-100 p-2 text-gray-400 active:scale-95 dark:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  )
}

function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  loading = false,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  tone?: 'danger' | 'default'
  loading?: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const toneClass =
    tone === 'danger'
      ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
      : 'bg-teal-600 text-white shadow-lg shadow-teal-600/25'

  return (
    <AppBottomSheet open={open} onClose={onClose} title={title} zIndex={620}>
      <div className="space-y-4">
        <p className="text-[14px] font-medium leading-relaxed text-gray-500 dark:text-gray-400">
          {description}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="rounded-[20px] border border-gray-200 bg-white py-3 text-[14px] font-bold text-gray-700 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-700 dark:text-gray-200"
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-[20px] py-3 text-[14px] font-bold active:scale-[0.98] disabled:opacity-60 ${toneClass}`}
          >
            {loading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </div>
    </AppBottomSheet>
  )
}

function PaymentHistoryItem({
  payment,
  onDelete,
}: {
  payment: PaymentTransaction
  onDelete: (paymentId: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-gray-100 bg-gray-50 p-3.5 dark:border-slate-700/50 dark:bg-slate-700/40">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-black text-emerald-600 dark:text-emerald-400">
          + {formatCurrency(Number(payment.amount) || 0)}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {format(new Date(`${payment.date}T12:00:00`), "dd 'de' MMM yyyy", {
            locale: ptBR,
          })}
          {payment.description ? ` • ${payment.description}` : ''}
        </p>
      </div>

      <button
        onClick={() => onDelete(payment.id)}
        aria-label="Excluir pagamento"
        className="rounded-full border border-gray-100 bg-white p-2 text-gray-400 shadow-sm transition-all active:scale-90 hover:text-red-500 dark:border-slate-700 dark:bg-slate-800"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

function DebtDetailContent() {
  // ========== TODOS OS HOOKS NO TOPO ==========
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { safeAdd, safeUpdate, safeDelete } = useSafeDb()

  const debtId = searchParams.get('id') as string
  const { debt, isLoading } = useDebtById(debtId)

  // ✅ HOOKS DE DADOS (chamados incondicionalmente)
  const {
    data: localTransactions,
    reload: reloadTransactions,
  } = useLocalData({
    table: 'transactions' as any,
    filters: { debt_id: debtId },
  })

  const {
    data: localAccounts,
    reload: reloadAccounts,
  } = useLocalData({
    table: 'accounts' as any,
    filters: { context: debt?.context || 'dfl' },
  })

  // ✅ TODOS OS STATES
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteDebtLoading, setDeleteDebtLoading] = useState(false)
  const [deletePaymentLoading, setDeletePaymentLoading] = useState(false)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [showAccModal, setShowAccModal] = useState(false)
  const [showDeleteDebtConfirm, setShowDeleteDebtConfirm] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<PaymentTransaction | null>(null)

  const [whatsAppNumber, setWhatsAppNumber] = useState('')
  const [whatsAppMessage, setWhatsAppMessage] = useState('')

  const [payAmountNum, setPayAmountNum] = useState(0)
  const [payAccountId, setPayAccountId] = useState('')
  const [payNote, setPayNote] = useState('')
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  // ✅ TODOS OS MEMOS
  const payments = useMemo(() => (localTransactions || []) as PaymentTransaction[], [localTransactions])
  const accounts = useMemo(() => (localAccounts || []) as Account[], [localAccounts])

  const totalPaid = useMemo(
    () => payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
    [payments]
  )

  const totalAmountCents = Math.round(Number(debt?.total_amount || 0) * 100)
  const totalPaidCents = Math.round(totalPaid * 100)
  const remainingCents = totalAmountCents - totalPaidCents
  const remaining = remainingCents / 100
  const percent = totalAmountCents > 0 ? (totalPaidCents / totalAmountCents) * 100 : 0
  const isPaid = debt?.status === 'paid' || remainingCents <= 0
  const daysUntilDue = debt?.due_date ? differenceInDays(new Date(debt.due_date), new Date()) : null
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && !isPaid

  const IconComp = getDynamicIcon(debt?.icon || 'user')
  const selectedAcc = accounts.find((a) => a.id === payAccountId)

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  // ✅ TODOS OS CALLBACKS
  const loadData = useCallback(async () => {
    if (!debtId) return
    setLoadingPulse(true)
    try {
      await Promise.all([
        reloadTransactions(),
        reloadAccounts(),
      ])
    } finally {
      setLoadingPulse(false)
    }
  }, [debtId, reloadTransactions, reloadAccounts])

  // ✅ TODOS OS EFFECTS
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 10 || isLoading) return
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
        loadData().finally(() => setRefreshing(false))
      }
    }

    const handleTouchEnd = () => {
      isPulling.current = false
    }

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
  }, [isLoading, refreshing, loadData, vibrate])

  useEffect(() => {
    if (!isLoading && !debt && debtId) {
      router.replace('/debts')
    }
  }, [isLoading, debt, debtId, router])

  useEffect(() => {
    if (!debt) return

    setWhatsAppMessage(
      `Olá ${debt.person_name}, tudo bem? Preciso lembrar sobre o pagamento de ${formatCurrency(
        Number(debt.total_amount)
      )}. Você pode verificar?`
    )
    setWhatsAppNumber(debt.phone || debt.whatsapp || '')
  }, [debt])

  // ========== SÓ DEPOIS DE TODOS OS HOOKS, OS RETORNOS CONDICIONAIS ==========
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-teal-600 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!debt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-slate-900">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">Registro não encontrado</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">A dívida que você procura não existe ou foi removida.</p>
        <button
          onClick={() => router.back()}
          className="mt-6 px-6 py-3 bg-teal-600 text-white rounded-[20px] font-bold hover:bg-teal-700 transition-colors active:scale-[0.98]"
        >
          Voltar
        </button>
      </div>
    )
  }

  // ========== RESTO DA LÓGICA (HANDLERS) ==========
  const resetPaymentForm = () => {
    setPayAmountNum(0)
    setPayNote('')
    setPayAccountId('')
    setPayDate(format(new Date(), 'yyyy-MM-dd'))
  }

  const openDeletePaymentConfirm = (paymentId: string) => {
    const payment = payments.find((p) => p.id === paymentId) || null
    setPaymentToDelete(payment)
  }

  const handleDeleteDebt = async () => {
    if (!user?.id || !debtId) return
    setDeleteDebtLoading(true)

    try {
      await db.transaction('rw', db.debts, db.transactions, db.accounts, db.syncQueue, async () => {
        for (const payment of payments) {
          if (payment.account_id) {
            const account = await db.table('accounts').get(payment.account_id)
            if (account) {
              const reversedBalance = Number(account.balance) - Number(payment.amount)
              const result = await safeUpdate('accounts', payment.account_id, {
                balance: reversedBalance,
              })
              if (!result.success) throw new Error(`Erro ao reverter conta: ${result.error}`)
            }
          }

          const result = await safeDelete('transactions', payment.id)
          if (!result.success) throw new Error(`Erro deletar pagamento: ${result.error}`)
        }

        const result = await safeDelete('debts', debtId)
        if (!result.success) throw new Error(`Erro ao excluir: ${result.error}`)
      })

      success()
      setShowDeleteDebtConfirm(false)
      showToast('🗑️ Registro excluído com sucesso.', 'success')
      router.push('/debts')
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, 'error')
    } finally {
      setDeleteDebtLoading(false)
    }
  }

  const handleDeletePayment = async () => {
    if (!user?.id || !debt || !paymentToDelete) return
    setDeletePaymentLoading(true)

    try {
      await db.transaction('rw', db.transactions, db.debts, db.accounts, db.syncQueue, async () => {
        if (paymentToDelete.account_id) {
          const account = await db.table('accounts').get(paymentToDelete.account_id)
          if (account) {
            const reversedBalance = Number(account.balance) - Number(paymentToDelete.amount)
            const result = await safeUpdate('accounts', paymentToDelete.account_id, {
              balance: reversedBalance,
            })
            if (!result.success) throw new Error(`Erro ao reverter conta: ${result.error}`)
          }
        }

        const result = await safeDelete('transactions', paymentToDelete.id)
        if (!result.success) throw new Error(`Erro deletar pagamento: ${result.error}`)

        const updatedPayments = payments.filter((p) => p.id !== paymentToDelete.id)
        const nextTotalPaid = updatedPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
        const nextTotalPaidCents = Math.round(nextTotalPaid * 100)

        const nextStatus: DebtStatus =
          nextTotalPaidCents >= totalAmountCents
            ? 'paid'
            : nextTotalPaidCents > 0
            ? 'partial'
            : 'pending'

        const debtResult = await safeUpdate('debts', debtId, {
          status: nextStatus,
          paid_amount: nextTotalPaidCents / 100,
          updated_at: new Date().toISOString(),
        })

        if (!debtResult.success) throw new Error(`Erro atualizar dívida: ${debtResult.error}`)
      })

      success()
      setPaymentToDelete(null)
      showToast('🗑️ Pagamento removido.', 'success')
      loadData()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, 'error')
    } finally {
      setDeletePaymentLoading(false)
    }
  }

  const handlePayment = async () => {
    if (isSubmitting || !user?.id || !debt) return

    if (payAmountNum <= 0) {
      showToast('⚠️ Digite um valor válido.', 'warning')
      errorHaptic()
      return
    }

    const payAmountCents = Math.round(payAmountNum * 100)

    if (payAmountCents > remainingCents) {
      showToast(`⚠️ O valor máximo que pode ser pago é ${formatCurrency(remaining)}.`, 'warning')
      errorHaptic()
      return
    }

    setIsSubmitting(true)

    try {
      const targetAccountId = payAccountId || debt.account_id || null
      const txId = crypto.randomUUID()

      const newTx = {
        id: txId,
        user_id: user.id,
        type: 'income',
        amount: payAmountNum,
        description: payNote || `Pagamento de ${debt.person_name}`,
        account_id: targetAccountId,
        debt_id: debtId,
        date: payDate,
        status: 'done',
        affects_balance: true,
        context: debt.context,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        sync_status: 'pending',
        sync_attempts: 0,
      }

      await db.transaction('rw', db.transactions, db.accounts, db.debts, db.syncQueue, async () => {
        const txResult = await safeAdd('transactions', newTx)
        if (!txResult.success) throw new Error(`Erro ao criar pagamento: ${txResult.error}`)

        if (targetAccountId) {
          const account = await db.table('accounts').get(targetAccountId)
          if (account) {
            const newBalance = Number(account.balance) + payAmountNum
            const accResult = await safeUpdate('accounts', targetAccountId, {
              balance: newBalance,
            })
            if (!accResult.success) throw new Error(`Erro ao atualizar conta: ${accResult.error}`)
          }
        }

        const newTotalPaidCents = totalPaidCents + payAmountCents
        const newStatus: DebtStatus = newTotalPaidCents >= totalAmountCents ? 'paid' : 'partial'

        const debtResult = await safeUpdate('debts', debtId, {
          status: newStatus,
          paid_amount: newTotalPaidCents / 100,
          updated_at: new Date().toISOString(),
        })

        if (!debtResult.success) throw new Error(`Erro atualizar dívida: ${debtResult.error}`)
      })

      success()
      setShowPaymentModal(false)
      resetPaymentForm()
      showToast('✅ Pagamento registrado com sucesso!', 'success')
      loadData()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendWhatsApp = () => {
    const number = whatsAppNumber.replace(/D/g, '')

    if (!number) {
      showToast('⚠️ Informe o número do WhatsApp.', 'warning')
      errorHaptic()
      return
    }

    vibrate([10])
    const url = `https://wa.me/55${number}?text=${encodeURIComponent(whatsAppMessage)}`
    window.open(url, '_blank')
    setShowWhatsAppModal(false)
  }

  // ========== RENDER ==========
  return (
    <div
      ref={containerRef}
      className="mx-auto min-h-screen max-w-md bg-gray-50 pb-24 font-sans transition-colors duration-300 dark:bg-slate-900"
    >
      {loadingPulse && (
        <div className="fixed right-4 top-20 z-50">
          <div className="h-3 w-3 animate-pulse rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
      )}

      {refreshing && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.1)] animate-in slide-in-from-top-2 duration-300 dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 px-4 pb-4 pt-6 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => {
                vibrate([5])
                router.back()
              }}
              className="rounded-full p-2 text-gray-800 transition-transform active:scale-95 dark:text-gray-200"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-bold text-gray-800 dark:text-gray-100">
                {debt.person_name}
              </h1>
              <p className="mt-0.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                {debt.context === 'dfl' ? 'Empresa' : 'Pessoal'}
              </p>
            </div>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => {
                vibrate([5])
                setShowWhatsAppModal(true)
              }}
              aria-label="Cobrar via WhatsApp"
              className="rounded-full bg-emerald-50 p-2.5 text-emerald-600 transition-all active:scale-95 dark:bg-emerald-900/30 dark:text-emerald-400"
            >
              <MessageCircle size={18} />
            </button>

            <button
              onClick={() => {
                vibrate([5])
                router.push(`/debts/new?edit=${debt.id}`)
              }}
              aria-label="Editar"
              className="rounded-full bg-teal-50 p-2.5 text-teal-700 transition-all active:scale-95 dark:bg-teal-900/30 dark:text-teal-400"
            >
              <Edit2 size={18} />
            </button>

            <button
              onClick={() => {
                vibrate([10])
                setShowDeleteDebtConfirm(true)
              }}
              aria-label="Excluir"
              className="rounded-full bg-red-50 p-2.5 text-red-500 transition-all active:scale-95 dark:bg-red-500/10"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="space-y-4 px-4 pt-6 animate-in fade-in duration-300">
        <SectionCard className="p-5">
          <div className="mb-5 flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[18px] shadow-sm"
              style={{ backgroundColor: `${debt.color || '#14b8a6'}15`, color: debt.color || '#14b8a6' }}
            >
              <IconComp size={24} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-[18px] font-black leading-tight text-gray-800 dark:text-gray-100">
                {debt.person_name}
              </p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
                {debt.description || 'Empréstimo'}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
              Valor total
            </p>
            <p className="mt-1 text-[30px] font-black tracking-tight text-gray-900 dark:text-white">
              {formatCurrency(Number(debt.total_amount))}
            </p>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <InfoRow label="Recebido" value={formatCurrency(totalPaid)} tone="success" />
            <InfoRow
              label={remainingCents > 0 ? 'Restante' : 'Status'}
              value={remainingCents > 0 ? formatCurrency(Math.abs(remaining)) : 'Pago'}
              tone={remainingCents > 0 ? 'warning' : 'success'}
            />
          </div>

          <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isPaid ? 'bg-emerald-500' : isOverdue ? 'bg-red-500' : 'bg-teal-500'
              }`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">
              {percent.toFixed(0)}% recebido
            </span>

            {isOverdue && !isPaid ? (
              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle size={10} />
                Atrasado {Math.abs(daysUntilDue || 0)} dia(s)
              </span>
            ) : !isPaid && debt.due_date ? (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 dark:text-gray-500">
                <Calendar size={12} />
                Vence {format(new Date(debt.due_date), 'dd/MM')}
              </span>
            ) : (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Quitado
              </span>
            )}
          </div>
        </SectionCard>

        {!isPaid && (
          <button
            onClick={() => {
              vibrate([5])
              setShowPaymentModal(true)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-teal-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-teal-600/25 transition-transform active:scale-[0.98]"
          >
            <Wallet size={18} />
            Registrar recebimento
          </button>
        )}

        <SectionCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[16px] font-bold text-gray-800 dark:text-gray-100">
              Histórico de pagamentos
            </h3>
            <span className="text-[12px] font-semibold text-gray-400 dark:text-gray-500">
              {payments.length} registro(s)
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 dark:bg-slate-700/50">
                <Clock3 size={20} className="text-gray-400" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500">
                Nenhum pagamento registrado.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((payment) => (
                <PaymentHistoryItem
                  key={payment.id}
                  payment={payment}
                  onDelete={openDeletePaymentConfirm}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </main>

      <AppBottomSheet
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Registrar recebimento"
      >
        <div className="space-y-4">
          <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 dark:border-slate-700/50 dark:bg-slate-700/40">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Valor recebido
            </label>

            <div className="flex items-center gap-2">
              <span className="text-[18px] font-medium text-gray-400">R$</span>
              <MoneyInput
                value={payAmountNum}
                onChange={(numValue) => setPayAmountNum(numValue)}
                className="w-full bg-transparent text-[24px] font-black text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
                placeholder="0,00"
                autoFocus
              />
            </div>

            <p className="mt-2 text-[10px] font-bold text-emerald-600/70">
              Máximo permitido: {formatCurrency(remaining)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 dark:border-slate-700/50 dark:bg-slate-700/40">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Data
              </label>
              <div className="flex items-center gap-2">
                <Calendar size={16} className="shrink-0 text-gray-400" />
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full bg-transparent text-[14px] font-bold text-gray-800 outline-none dark:text-gray-200"
                />
              </div>
            </div>

            <button
              onClick={() => setShowAccModal(true)}
              className="flex flex-col justify-center rounded-[20px] border border-gray-100 bg-gray-50 p-4 text-left transition-transform active:scale-95 dark:border-slate-700/50 dark:bg-slate-700/40"
            >
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                Destino
              </label>
              <div className="flex items-center gap-2">
                <Wallet size={16} className="shrink-0 text-gray-400" />
                <span
                  className={`truncate text-[13px] font-bold ${
                    selectedAcc ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400'
                  }`}
                >
                  {selectedAcc ? selectedAcc.name : 'Nenhuma conta'}
                </span>
              </div>
            </button>
          </div>

          <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 dark:border-slate-700/50 dark:bg-slate-700/40">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Observação
            </label>
            <input
              type="text"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
              placeholder="Ex: Pagamento da 1ª parcela"
              className="w-full bg-transparent text-[15px] font-bold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
            />
          </div>

          <button
            onClick={() => {
              vibrate([10, 50])
              handlePayment()
            }}
            disabled={isSubmitting || payAmountNum <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-teal-600 py-4 text-[16px] font-bold text-white shadow-lg shadow-teal-600/30 transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
            {isSubmitting ? 'Processando...' : 'Confirmar recebimento'}
          </button>
        </div>
      </AppBottomSheet>

      <AppBottomSheet
        open={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        title="Cobrar via WhatsApp"
      >
        <div className="space-y-4">
          <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 dark:border-slate-700/50 dark:bg-slate-700/40">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Número
            </label>
            <input
              type="tel"
              inputMode="numeric"
              value={whatsAppNumber}
              onChange={(e) => setWhatsAppNumber(e.target.value)}
              placeholder="11999999999"
              className="w-full bg-transparent text-[16px] font-bold text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
            />
          </div>

          <div className="rounded-[20px] border border-gray-100 bg-gray-50 p-4 dark:border-slate-700/50 dark:bg-slate-700/40">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
              Mensagem
            </label>
            <textarea
              rows={5}
              value={whatsAppMessage}
              onChange={(e) => setWhatsAppMessage(e.target.value)}
              className="w-full resize-none bg-transparent text-[14px] font-medium text-gray-800 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
              placeholder="Mensagem para cobrança..."
            />
          </div>

          <button
            onClick={handleSendWhatsApp}
            className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-emerald-500 py-4 text-[16px] font-bold text-white shadow-lg shadow-emerald-500/30 transition-transform active:scale-[0.98]"
          >
            <MessageCircle size={18} />
            Abrir WhatsApp
          </button>
        </div>
      </AppBottomSheet>

      <AppBottomSheet
        open={showAccModal}
        onClose={() => setShowAccModal(false)}
        title="Selecionar conta"
        zIndex={610}
      >
        <div className="max-h-[55vh] space-y-2 overflow-y-auto pb-2">
          {accounts.map((acc) => {
            const isActive = acc.id === payAccountId

            return (
              <button
                key={acc.id}
                onClick={() => {
                  vibrate([5])
                  setPayAccountId(acc.id)
                  setShowAccModal(false)
                }}
                className={`flex w-full items-center gap-4 rounded-[20px] p-4 text-left transition-transform active:scale-[0.98] ${
                  isActive
                    ? 'border border-teal-100 bg-teal-50 dark:border-teal-800/50 dark:bg-teal-900/30'
                    : 'border border-transparent bg-gray-50 dark:bg-slate-700/40'
                }`}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-[16px] text-white shadow-sm"
                  style={{ backgroundColor: acc.color || '#0f766e' }}
                >
                  <Wallet size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[15px] font-bold ${
                      isActive ? 'text-teal-700 dark:text-teal-400' : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {acc.name}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                    Saldo: {formatCurrency(Number(acc.balance) || 0)}
                  </p>
                </div>

                {isActive && <Check size={18} className="text-teal-600 dark:text-teal-400" />}
              </button>
            )
          })}

          {accounts.length === 0 && (
            <p className="py-8 text-center text-[13px] font-medium text-gray-400 dark:text-gray-500">
              Nenhuma conta encontrada.
            </p>
          )}
        </div>
      </AppBottomSheet>

      <ConfirmSheet
        open={showDeleteDebtConfirm}
        onClose={() => setShowDeleteDebtConfirm(false)}
        onConfirm={handleDeleteDebt}
        loading={deleteDebtLoading}
        title="Excluir registro"
        description="Essa ação remove a dívida e também exclui todos os pagamentos vinculados, revertendo os saldos nas contas afetadas."
        confirmLabel="Excluir tudo"
        tone="danger"
      />

      <ConfirmSheet
        open={!!paymentToDelete}
        onClose={() => setPaymentToDelete(null)}
        onConfirm={handleDeletePayment}
        loading={deletePaymentLoading}
        title="Excluir pagamento"
        description="O valor será removido do histórico e também descontado da conta onde esse recebimento foi lançado."
        confirmLabel="Excluir pagamento"
        tone="danger"
      />
    </div>
  )
}

export default function DebtDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
          <Loader2 className="animate-spin text-teal-600" size={28} />
        </div>
      }
    >
      <DebtDetailContent />
    </Suspense>
  )
}