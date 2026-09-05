// src/app/(app)/loans/details/page.tsx
'use client'

import { useEffect, useState, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Edit3, Trash2, ArrowLeft, HandCoins, Calendar, Landmark,
  CheckCircle2, AlertTriangle, Clock, X, RefreshCw, FileText, User, CalendarDays,
  Percent, Wallet, ReceiptText
} from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLoanById } from '@/hooks/useLoanById'
import { useLoanPayments } from '@/hooks/useLoanPayments'
import { useContext_ } from '@/components/ContextToggle'
import { useSafeDb } from '@/hooks/useSafeDb'
import Skeleton from '@/components/Skeleton'

// ============================================================
// COMPONENTES VISUAIS (apenas estrutura, sem lógica)
// ============================================================

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-gray-100 dark:border-slate-800 pb-3 mb-4">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: 'active' | 'paid' | 'overdue' }) {
  const config = {
    active: { bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', icon: Clock, label: 'Ativo' },
    paid: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', icon: CheckCircle2, label: 'Pago' },
    overdue: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: AlertTriangle, label: 'Atrasado' },
  }
  const { bg, text, icon: Icon, label } = config[status] || config.active

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${bg} ${text}`}>
      <Icon size={12} />
      {label}
    </span>
  )
}

function SummaryCard({ label, value, color = 'gray' }: { label: string; value: string; color?: 'gray' | 'green' | 'blue' }) {
  const colorMap = {
    gray: 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700/70 text-gray-900 dark:text-gray-100',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 text-blue-700 dark:text-blue-400',
  }

  return (
    <div className={`rounded-2xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

function DetailRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 dark:border-slate-800/50 last:border-0">
      <div className="flex items-center gap-2">
        {icon && <span className="text-gray-400 dark:text-gray-500">{icon}</span>}
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</span>
    </div>
  )
}

function DetailText({ label, value }: { label: string; value: string }) {
  return (
    <div className="pt-2">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{value}</p>
    </div>
  )
}

function PaymentItem({ payment, formatCurrency, formatDate }: { payment: any; formatCurrency: (val: number) => string; formatDate: (date: string | null) => string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-slate-800/50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {formatDate(payment.date)}
        </p>
        {payment.description && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate max-w-[150px]">{payment.description}</p>
        )}
      </div>
      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
        + {formatCurrency(Number(payment.amount) || 0)}
      </span>
    </div>
  )
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  processing = false,
}: {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
  processing?: boolean
}) {
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-2xl animate-in slide-in-from-bottom-8 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
        <div className="mb-6 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner ${destructive ? 'bg-red-50 dark:bg-red-900/30' : 'bg-teal-50 dark:bg-teal-900/30'}`}>
            {destructive ? <Trash2 size={28} className="text-red-500" /> : <HandCoins size={28} className="text-teal-500" />}
          </div>
          <h3 className="text-[20px] font-black text-gray-800 dark:text-gray-100 tracking-tight">{title}</h3>
          <p className="text-[14px] text-gray-500 dark:text-gray-400 mt-2 font-medium">{description}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 py-4 rounded-[20px] bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 font-bold text-[15px] hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors active:scale-[0.98] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={processing}
            className={`flex-1 py-4 rounded-[20px] text-white font-bold text-[15px] shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 ${
              destructive
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/20'
            }`}
          >
            {processing ? <RefreshCw size={18} className="animate-spin mx-auto" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ============================================================
// SKELETON
// ============================================================

const LoanDetailSkeleton = () => (
  <div className="min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950">
    <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#f6f7f8]/90 dark:bg-slate-950/85 border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div className="h-11 w-11 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
        <div className="h-6 w-40 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="h-11 w-11 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
      </div>
    </div>
    <div className="px-4 pt-6 space-y-5">
      <div className="animate-pulse rounded-3xl bg-white dark:bg-slate-900 p-5 border border-black/5 dark:border-white/10">
        <div className="h-4 w-24 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-10 w-40 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="h-20 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
          <div className="h-20 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
      <div className="animate-pulse rounded-3xl bg-white dark:bg-slate-900 p-5 border border-black/5 dark:border-white/10">
        <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
        <div className="h-12 bg-gray-100 dark:bg-slate-800 rounded-2xl" />
        <div className="h-12 bg-gray-100 dark:bg-slate-800 rounded-2xl mt-3" />
        <div className="h-12 bg-gray-100 dark:bg-slate-800 rounded-2xl mt-3" />
      </div>
    </div>
  </div>
)

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

function LoanDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { safeUpdate, safeDelete } = useSafeDb()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  // HOOKS (mantidos exatamente iguais)
  const { data: loan, loading, notFound } = useLoanById(id)
  const { data: payments, loading: paymentsLoading } = useLoanPayments(id)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [processing, setProcessing] = useState(false)

  // FUNÇÕES AUXILIARES (mantidas exatamente iguais)
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

  const formatDate = (date: string | null) => 
    date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : "—"

  // TRATAMENTO DE LOADING
  if (loading) {
    return <LoanDetailSkeleton />
  }

  // TRATAMENTO DE NÃO ENCONTRADO
  if (notFound) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#f6f7f8] dark:bg-slate-950">
        <div className="text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
            <HandCoins size={32} className="text-red-500" />
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-200">Empréstimo não encontrado</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">O empréstimo pode ter sido excluído ou você não tem permissão.</p>
          <button
            onClick={() => router.back()}
            className="mt-6 px-6 py-3 rounded-xl bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors active:scale-95"
          >
            Voltar
          </button>
        </div>
      </div>
    )
  }

  if (!loan) return null

  // CÁLCULOS (mantidos exatamente iguais)
  const isLent = loan.direction === "lent"
  const amount = Number(loan.amount) || 0
  const totalPaid = (payments || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
  const remaining = Math.max(0, amount - totalPaid)
  const interestRate = Number(loan.interest_rate) || 0
  const status = loan.status || "active"

  const accent = isLent ? {
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-600",
    bgSoft: "bg-teal-50 dark:bg-teal-900/20",
    borderSoft: "border-teal-100 dark:border-teal-800/40",
    hover: "hover:bg-teal-700",
    shadow: "shadow-teal-600/20",
  } : {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500",
    bgSoft: "bg-orange-50 dark:bg-orange-900/20",
    borderSoft: "border-orange-100 dark:border-orange-800/40",
    hover: "hover:bg-orange-600",
    shadow: "shadow-orange-500/20",
  }

  // HANDLERS (mantidos exatamente iguais)
  const handlePay = async () => {
    setProcessing(true)
    try {
      const res = await safeUpdate('loans', loan.id, {
        status: 'paid',
        remaining_amount: 0,
        updated_at: new Date().toISOString(),
      })
      if (!res.success) throw new Error(res.error)
      success()
      showToast("Empréstimo marcado como quitado.", "success")
      setShowPayConfirm(false)
    } catch (err: any) {
      errorHaptic()
      showToast(`Não foi possível atualizar o empréstimo: ${err.message}`, "error")
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    setProcessing(true)
    try {
      for (const p of (payments || [])) {
        await safeDelete('transactions', p.id)
      }
      const res = await safeDelete('loans', loan.id)
      if (!res.success) throw new Error(res.error)
      success()
      showToast("Empréstimo excluído com sucesso.", "success")
      setShowDeleteConfirm(false)
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`Não foi possível excluir o empréstimo: ${err.message}`, "error")
    } finally {
      setProcessing(false)
    }
  }

  // RENDERIZAÇÃO REFATORADA
  return (
    <div className="min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950">
      {/* ============================================================
          BLOCO 1: HEADER STICKY
          ============================================================ */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#f6f7f8]/90 dark:bg-slate-950/85 border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => { vibrate([5]); router.back(); }}
            className="h-11 w-11 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 bg-white/80 dark:bg-slate-800/80 border border-black/5 dark:border-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="text-center min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Detalhes do empréstimo</p>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {loan.description || 'Empréstimo'}
            </h1>
          </div>

          <button
            onClick={() => { vibrate([5]); router.push(`/loans/new?edit=${loan.id}`); }}
            className="h-11 w-11 rounded-full flex items-center justify-center text-gray-800 dark:text-gray-200 active:scale-95 bg-white/80 dark:bg-slate-800/80 border border-black/5 dark:border-white/10"
            aria-label="Editar"
          >
            <Edit3 size={20} />
          </button>
        </div>
      </div>

      {/* ============================================================
          BLOCO 2: CONTEÚDO PRINCIPAL
          ============================================================ */}
      <div className="px-4 pt-6 pb-28 space-y-5">

        {/* Hero Card */}
        <div className={`rounded-3xl p-5 ${accent.bgSoft} border ${accent.borderSoft}`}>
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${accent.text}`}>
                {isLent ? 'Você emprestou' : 'Você pegou emprestado'}
              </p>
              <h2 className="mt-1 text-3xl font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(amount)}
              </h2>
            </div>
            <StatusBadge status={status as 'active' | 'paid' | 'overdue'} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Restante</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(remaining)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Juros</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {interestRate ? `${interestRate}% a.m.` : 'Sem juros'}
              </p>
            </div>
          </div>

          {amount > 0 && (
            <div className="mt-4 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Progresso</p>
                <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{Math.min(100, Math.max(0, Math.round((totalPaid / amount) * 100)))}%</p>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                <div className={`h-full rounded-full bg-gradient-to-r ${isLent ? 'from-emerald-500 to-teal-500' : 'from-orange-500 to-amber-400'} transition-all`} style={{ width: `${Math.min(100, Math.max(0, (totalPaid / amount) * 100))}%` }} />
              </div>
            </div>
          )}

          {payments && payments.length > 0 && (
            <div className="mt-3 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Total pago</p>
                <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Informações */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 p-5">
          <SectionTitle title="Informações" />

          <div className="space-y-0">
            <DetailRow 
              label="Pessoa/Empresa" 
              value={loan.lender || '—'} 
              icon={<User size={14} />} 
            />
            <DetailRow 
              label="Data" 
              value={formatDate(loan.date)} 
              icon={<Calendar size={14} />} 
            />
            <DetailRow 
              label="Vencimento" 
              value={formatDate(loan.due_date)} 
              icon={<CalendarDays size={14} />} 
            />
          </div>

          <DetailText label="Observações" value={loan.notes || 'Sem observações'} />
        </section>

        {/* Pagamentos */}
        <section className="rounded-3xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle title={`Pagamentos (${payments?.length || 0})`} />
          </div>

          {paymentsLoading ? (
            <div className="flex justify-center py-8">
              <RefreshCw size={24} className="animate-spin text-teal-500" />
            </div>
          ) : !payments || payments.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <ReceiptText size={20} className="text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Nenhum pagamento registrado.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-slate-800/50">
              {payments.map((p: any) => (
                <PaymentItem 
                  key={p.id} 
                  payment={p} 
                  formatCurrency={formatCurrency} 
                  formatDate={formatDate} 
                />
              ))}
            </div>
          )}
        </section>

        {/* Ações */}
        <div className="space-y-3 pt-2">
          <button
            onClick={() => { vibrate([10]); setShowPayConfirm(true); }}
            disabled={status === 'paid' || remaining <= 0}
            className={`w-full rounded-2xl py-4 font-semibold text-white ${accent.bg} ${accent.hover} disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] shadow-lg ${accent.shadow}`}
          >
            {status === 'paid' ? 'Empréstimo quitado' : remaining <= 0 ? 'Quitado' : 'Marcar como quitado'}
          </button>

          <button
            onClick={() => { vibrate([10]); setShowDeleteConfirm(true); }}
            className="w-full rounded-2xl border border-red-200 dark:border-red-900/40 py-4 font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-[0.98]"
          >
            Excluir empréstimo
          </button>
        </div>
      </div>

      {/* ============================================================
          BLOCO 5: CONFIRM MODALS
          ============================================================ */}
      {showPayConfirm && (
        <ConfirmModal
          title="Marcar como pago?"
          description="Essa ação vai zerar o valor restante e atualizar o status do empréstimo."
          confirmLabel={processing ? 'Processando...' : 'Confirmar'}
          cancelLabel="Cancelar"
          onConfirm={handlePay}
          onCancel={() => setShowPayConfirm(false)}
          processing={processing}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Excluir empréstimo?"
          description="Essa ação não pode ser desfeita. Todos os pagamentos vinculados também serão excluídos."
          confirmLabel={processing ? 'Excluindo...' : 'Excluir'}
          cancelLabel="Cancelar"
          destructive
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          processing={processing}
        />
      )}
    </div>
  )
}

export default function LoanDetailPage() {
  return (
    <Suspense fallback={<LoanDetailSkeleton />}>
      <LoanDetailContent />
    </Suspense>
  )
}