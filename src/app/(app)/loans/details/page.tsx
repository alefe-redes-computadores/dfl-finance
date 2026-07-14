'use client'

import { useEffect, useState, useRef, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Edit3, Trash2, ArrowLeft, HandCoins, Calendar, Landmark,
  CheckCircle2, AlertTriangle, Clock, X, RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useLoanById } from '@/hooks/useLoanById' // ✅ NOVO HOOK
import { useLoanPayments } from '@/hooks/useLoanPayments' // ✅ NOVO HOOK
import { useContext_ } from '@/components/ContextToggle'
import { useSafeDb } from '@/hooks/useSafeDb'
import Skeleton from '@/components/Skeleton'

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

function LoanDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get("id")
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { safeUpdate, safeDelete } = useSafeDb()
  const { context, appMode } = useContext_()
  const effectiveContext = appMode === 'personal_only' ? 'personal' : context

  // ✅ HOOK ESPECÍFICO POR ID
  const { data: loan, loading, notFound } = useLoanById(id)

  // ✅ HOOK DE RELACIONAMENTO (pagamentos do empréstimo)
  const { data: payments, loading: paymentsLoading } = useLoanPayments(id)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [processing, setProcessing] = useState(false)

  // ✅ TRATAMENTO DE LOADING
  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950">
        <div className="sticky top-0 z-30 backdrop-blur-xl bg-[#f6f7f8]/90 dark:bg-slate-950/85 border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <div className="h-11 w-11 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
            <div className="h-6 w-40 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-11 w-11 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="px-4 pt-6">
          <Skeleton count={4} />
        </div>
      </div>
    )
  }

  // ✅ TRATAMENTO DE NÃO ENCONTRADO
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

  const statusMap = {
    active: { label: "Ativo", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    paid: { label: "Pago", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    overdue: { label: "Atrasado", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  } as const

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
      showToast("✅ Empréstimo marcado como pago!", "success")
      setShowPayConfirm(false)
      // ✅ NÃO PRECISA router.refresh() – a UI atualiza automaticamente via IndexedDB
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    setProcessing(true)
    try {
      // Exclui pagamentos vinculados
      for (const p of (payments || [])) {
        await safeDelete('transactions', p.id)
      }
      
      const res = await safeDelete('loans', loan.id)
      if (!res.success) throw new Error(res.error)
      success()
      showToast("🗑️ Empréstimo excluído", "success")
      setShowDeleteConfirm(false)
      router.back()
    } catch (err: any) {
      errorHaptic()
      showToast(`❌ Erro: ${err.message}`, "error")
    } finally {
      setProcessing(false)
    }
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val)

  const formatDate = (date: string | null) => 
    date ? format(new Date(date), "dd/MM/yyyy") : "—"

  return (
    <div className="min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950">
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
            <h1 className="text-[18px] font-semibold text-gray-900 dark:text-gray-100 truncate">
              Detalhes do Empréstimo
            </h1>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {loan.description}
            </p>
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

      <div className="px-4 pt-6 pb-28 space-y-4">
        <div className={`rounded-[28px] p-5 ${accent.bgSoft} border ${accent.borderSoft}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${accent.text}`}>
                {isLent ? "Você emprestou" : "Você pegou"}
              </p>
              <h2 className="mt-2 text-[30px] font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(amount)}
              </h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-[12px] font-semibold ${statusMap[status as keyof typeof statusMap]?.color ?? statusMap.active.color}`}>
              {statusMap[status as keyof typeof statusMap]?.label ?? "Ativo"}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Restante</p>
              <p className="mt-2 text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(remaining)}
              </p>
            </div>
            <div className="rounded-[18px] bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10 p-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Juros</p>
              <p className="mt-2 text-[18px] font-semibold text-gray-900 dark:text-gray-100">
                {interestRate ? `${interestRate}% a.m.` : "Sem juros"}
              </p>
            </div>
          </div>

          {payments && payments.length > 0 && (
            <div className="mt-4 rounded-[18px] bg-white/70 dark:bg-slate-900/60 border border-black/5 dark:border-white/10 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">Total pago</p>
                <p className="text-[18px] font-semibold text-teal-600 dark:text-teal-400">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[24px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 p-4 space-y-4">
          <DetailRow label="Pessoa/Empresa" value={loan.lender || "—"} />
          <DetailRow label="Data" value={formatDate(loan.date)} />
          <DetailRow label="Vencimento" value={formatDate(loan.due_date)} />
          <DetailRow label="Observações" value={loan.notes || "Sem observações"} multiline />
        </div>

        {payments && payments.length > 0 && (
          <div className="rounded-[24px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/10 p-4">
            <h3 className="text-[13px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Pagamentos</h3>
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                  <span className="text-[13px] font-medium text-gray-600 dark:text-gray-400">
                    {formatDate(p.date)}
                  </span>
                  <span className="text-[13px] font-bold text-teal-600 dark:text-teal-400">
                    {formatCurrency(Number(p.amount) || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { vibrate([10]); setShowPayConfirm(true); }}
            disabled={status === "paid" || remaining <= 0}
            className={`rounded-[20px] py-4 font-semibold text-white ${accent.bg} ${accent.hover} disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]`}
          >
            {status === "paid" ? "Já pago" : remaining <= 0 ? "Quitado" : "Marcar pago"}
          </button>
          <button
            onClick={() => { vibrate([10]); setShowDeleteConfirm(true); }}
            className="rounded-[20px] py-4 font-semibold bg-gray-900 text-white dark:bg-red-600 dark:hover:bg-red-700 transition-all active:scale-[0.98]"
          >
            Excluir
          </button>
        </div>
      </div>

      {showPayConfirm && (
        <ConfirmModal
          title="Marcar como pago?"
          description="Essa ação vai zerar o valor restante e atualizar o status do empréstimo."
          confirmLabel={processing ? "Processando..." : "Confirmar"}
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
          confirmLabel={processing ? "Excluindo..." : "Excluir"}
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

function DetailRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={`flex ${multiline ? 'flex-col' : 'items-center justify-between'} gap-1 ${multiline ? '' : 'py-1'}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">{label}</span>
      <span className={`text-[14px] font-medium text-gray-800 dark:text-gray-200 ${multiline ? 'mt-1' : ''}`}>
        {value}
      </span>
    </div>
  )
}

export default function LoanDetailPage() {
  return (
    <Suspense fallback={<div className="flex flex-col h-[100dvh] bg-slate-50 dark:bg-slate-950"><div className="flex-1 px-4 pt-4"><Skeleton count={4} /></div></div>}>
      <LoanDetailContent />
    </Suspense>
  )
}