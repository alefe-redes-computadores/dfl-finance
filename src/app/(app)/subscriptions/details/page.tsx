// src/app/(app)/subscriptions/details/page.tsx
'use client'

import { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  ArrowLeft,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Edit3,
  Pause,
  Play,
  Repeat,
  Tag,
  Trash2,
  XCircle,
  FileText,
} from 'lucide-react'
import { useSubscriptionById } from '@/hooks/useSubscriptionById'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useToast } from '@/contexts/ToastContext'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import Skeleton from '@/components/Skeleton'

const CYCLE_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannually: 'Semestral',
  yearly: 'Anual',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

function toMonthlyAmount(amount: number, cycle: string) {
  switch (cycle) {
    case 'weekly': return amount * 4.33
    case 'quarterly': return amount / 3
    case 'semiannually': return amount / 6
    case 'yearly': return amount / 12
    default: return amount
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0)
}

function formatLocalDate(value?: string | null) {
  if (!value) return 'Não informada'
  const iso = String(value).split('T')[0]
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function SubscriptionDetailsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')?.trim() || null
  const { data, loading, notFound } = useSubscriptionById(id)
  const subscription: any = data
  const { safeUpdate, safeDelete } = useSafeDb()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  const monthlyEquivalent = useMemo(() => {
    if (!subscription) return 0
    return toMonthlyAmount(Number(subscription.amount) || 0, subscription.billing_cycle)
  }, [subscription])

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 px-4 pt-6">
        <Skeleton count={6} />
      </div>
    )
  }

  if (!id || notFound || !subscription) {
    return (
      <div className="min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 flex items-center justify-center px-5">
        <div className="max-w-sm w-full rounded-[30px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 p-6 text-center">
          <div className="w-16 h-16 rounded-[22px] bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Repeat size={28} className="text-gray-400" />
          </div>
          <h1 className="text-[20px] font-bold text-gray-900 dark:text-white">Assinatura não encontrada</h1>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">Ela pode ter sido removida ou não pertencer ao usuário atual.</p>
          <button onClick={() => router.push('/subscriptions')} className="mt-5 h-12 px-5 rounded-[18px] bg-teal-600 text-white font-bold active:scale-[0.98] transition-transform">
            Voltar para assinaturas
          </button>
        </div>
      </div>
    )
  }

  const setStatus = async (status: 'active' | 'paused' | 'cancelled') => {
    if (!id || saving) return
    setSaving(true)
    vibrate([10])
    try {
      const result = await safeUpdate('subscriptions', id, {
        status,
        updated_at: new Date().toISOString(),
      })
      if (!result.success) throw new Error(result.error || 'Não foi possível atualizar o status.')
      success()
      showToast(status === 'active' ? 'Assinatura reativada' : status === 'paused' ? 'Assinatura pausada' : 'Assinatura cancelada', 'success')
    } catch (err: any) {
      errorHaptic()
      showToast(err?.message || 'Não foi possível atualizar a assinatura.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || saving) return
    setSaving(true)
    try {
      const result = await safeDelete('subscriptions', id)
      if (!result.success) throw new Error(result.error || 'Não foi possível excluir a assinatura.')
      success()
      showToast('Assinatura excluída', 'success')
      setShowDelete(false)
      router.replace('/subscriptions')
    } catch (err: any) {
      errorHaptic()
      showToast(err?.message || 'Não foi possível excluir a assinatura.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const status = subscription.status || 'active'
  const statusTone = status === 'active'
    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : status === 'paused'
      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'

  return (
    <div className="max-w-md mx-auto min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 pb-28 transition-colors">
      <header className="sticky top-0 z-30 bg-[#f6f7f8]/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => { vibrate([5]); router.back() }} className="h-10 w-10 rounded-[16px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 flex items-center justify-center active:scale-95 transition-transform">
            <ArrowLeft size={20} />
          </button>
          <div className="text-center min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-gray-400">Assinatura</p>
            <h1 className="text-[17px] font-bold text-gray-900 dark:text-white truncate">{subscription.name}</h1>
          </div>
          <button onClick={() => router.push(`/subscriptions/new?edit=${id}`)} className="h-10 w-10 rounded-[16px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 flex items-center justify-center text-teal-600 dark:text-teal-400 active:scale-95 transition-transform">
            <Edit3 size={18} />
          </button>
        </div>
      </header>

      <main className="px-4 pt-5 space-y-4">
        <section className="rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 dark:from-slate-800 dark:via-slate-900 dark:to-teal-950 text-white p-6 shadow-xl shadow-slate-900/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone}`}>{STATUS_LABELS[status] || status}</span>
              <p className="mt-5 text-[12px] font-medium text-white/60">Valor por cobrança</p>
              <p className="mt-1 text-[34px] leading-none font-black tracking-tight">{formatCurrency(subscription.amount)}</p>
              <p className="mt-3 text-[13px] text-white/65">{CYCLE_LABELS[subscription.billing_cycle] || subscription.billing_cycle}</p>
            </div>
            <div className="w-14 h-14 rounded-[20px] bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <Repeat size={25} className="text-teal-300" />
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 gap-3">
            <div className="rounded-[18px] bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-white/45">Impacto mensal</p>
              <p className="mt-1 text-[16px] font-bold">{formatCurrency(monthlyEquivalent)}</p>
            </div>
            <div className="rounded-[18px] bg-white/5 border border-white/10 p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] font-bold text-white/45">Próxima cobrança</p>
              <p className="mt-1 text-[16px] font-bold">{formatLocalDate(subscription.next_due_date)}</p>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 overflow-hidden">
          {[
            { icon: CalendarDays, label: 'Ciclo', value: CYCLE_LABELS[subscription.billing_cycle] || subscription.billing_cycle || 'Não informado' },
            { icon: Tag, label: 'Categoria', value: subscription.category || 'Não informada' },
            { icon: CreditCard, label: 'Forma de pagamento', value: subscription.payment_method || 'Não informada' },
            { icon: CircleDollarSign, label: 'Próxima cobrança', value: formatLocalDate(subscription.next_due_date) },
          ].map((item, index) => (
            <div key={item.label} className={`flex items-center gap-3 px-4 py-4 ${index ? 'border-t border-black/5 dark:border-white/5' : ''}`}>
              <div className="w-10 h-10 rounded-[14px] bg-gray-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                <item.icon size={17} className="text-gray-500 dark:text-gray-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400">{item.label}</p>
                <p className="mt-0.5 text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </section>

        {subscription.notes && (
          <section className="rounded-[28px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText size={17} className="text-gray-400" />
              <h2 className="text-[13px] font-bold text-gray-800 dark:text-gray-200">Observações</h2>
            </div>
            <p className="text-[14px] leading-6 text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{subscription.notes}</p>
          </section>
        )}

        <section className="rounded-[28px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 p-4 space-y-2">
          <p className="px-1 pb-1 text-[11px] uppercase tracking-[0.12em] font-bold text-gray-400">Ações</p>
          {status === 'active' ? (
            <button disabled={saving} onClick={() => setStatus('paused')} className="w-full h-12 rounded-[18px] bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50">
              <Pause size={17} /> Pausar assinatura
            </button>
          ) : (
            <button disabled={saving} onClick={() => setStatus('active')} className="w-full h-12 rounded-[18px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50">
              <Play size={17} /> Reativar assinatura
            </button>
          )}

          {status !== 'cancelled' && (
            <button disabled={saving} onClick={() => setStatus('cancelled')} className="w-full h-12 rounded-[18px] bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50">
              <XCircle size={17} /> Cancelar assinatura
            </button>
          )}

          <button disabled={saving} onClick={() => setShowDelete(true)} className="w-full h-12 rounded-[18px] bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300 font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-50">
            <Trash2 size={17} /> Excluir assinatura
          </button>
        </section>
      </main>

      {showDelete && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDelete(false)}>
          <div className="w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] bg-white dark:bg-slate-900 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={27} className="text-red-500" />
            </div>
            <h2 className="text-[20px] font-black text-center text-gray-900 dark:text-white">Excluir assinatura?</h2>
            <p className="mt-2 text-[14px] text-center text-gray-500 dark:text-gray-400">O histórico financeiro existente não será apagado por esta ação.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowDelete(false)} className="flex-1 h-12 rounded-[18px] bg-gray-100 dark:bg-slate-800 font-bold text-gray-700 dark:text-gray-300">Cancelar</button>
              <button disabled={saving} onClick={handleDelete} className="flex-1 h-12 rounded-[18px] bg-red-500 text-white font-bold disabled:opacity-50">Excluir</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function SubscriptionDetailsPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950" />}>
      <SubscriptionDetailsContent />
    </Suspense>
  )
}
