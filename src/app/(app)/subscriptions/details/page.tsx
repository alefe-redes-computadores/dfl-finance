'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Pencil,
  Calendar,
  CreditCard,
  FileText,
  Repeat,
  Tag,
  Loader2,
  Clock,
  AlertTriangle,
} from 'lucide-react'
import Skeleton from '@/components/Skeleton'
import { useSubscriptionById } from '@/hooks/useSubscriptionById'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(val || 0)
}

function formatDate(date: string | null | undefined) {
  if (!date) return '—'
  const normalized = date.includes('T') ? date : `${date}T12:00:00`
  const d = new Date(normalized)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getBillingCycleLabel(cycle?: string) {
  switch (cycle) {
    case 'monthly': return 'Mensal'
    case 'yearly': return 'Anual'
    case 'weekly': return 'Semanal'
    case 'quarterly': return 'Trimestral'
    case 'semiannually': return 'Semestral'
    default: return cycle || '—'
  }
}

function getStatusInfo(status?: string) {
  switch (status) {
    case 'active':
      return {
        label: 'Ativa',
        color: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        icon: Clock,
      }
    case 'paused':
      return {
        label: 'Pausada',
        color: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        icon: AlertTriangle,
      }
    case 'cancelled':
      return {
        label: 'Cancelada',
        color: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
        icon: AlertTriangle,
      }
    default:
      return {
        label: status || '—',
        color: 'text-gray-500 dark:text-gray-400',
        bg: 'bg-gray-100 dark:bg-slate-800',
        icon: Clock,
      }
  }
}

function SubscriptionDetailsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { vibrate } = useHapticFeedback()

  const id = searchParams.get('id')
  const { data: subscription, loading, notFound } = useSubscriptionById(id)

  if (!id) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
            ID da assinatura não informado.
          </p>
          <button
            onClick={() => router.push('/subscriptions')}
            className="mt-4 px-6 py-3 bg-teal-600 text-white rounded-full font-semibold"
          >
            Voltar para listagem
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
        <div className="sticky top-0 z-30 bg-[#f6f7f8]/88 dark:bg-slate-950/88 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="text-center">
              <h1 className="text-[18px] font-bold text-gray-900 dark:text-gray-50">
                Detalhes
              </h1>
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                Carregando assinatura...
              </p>
            </div>
            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 px-4 pt-6">
          <Skeleton count={5} />
        </div>
      </div>
    )
  }

  if (notFound || !subscription) {
    return (
      <div className="min-h-screen bg-[#f6f7f8] dark:bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-[15px] font-semibold text-gray-800 dark:text-gray-200">
            Assinatura não encontrada.
          </p>
          <button
            onClick={() => router.push('/subscriptions')}
            className="mt-4 px-6 py-3 bg-teal-600 text-white rounded-full font-semibold"
          >
            Voltar para listagem
          </button>
        </div>
      </div>
    )
  }

  const status = getStatusInfo(subscription.status)
  const StatusIcon = status.icon

  return (
    <div className="flex flex-col h-[100dvh] bg-[#f6f7f8] dark:bg-slate-950 transition-colors duration-300">
      <div className="sticky top-0 z-30 bg-[#f6f7f8]/88 dark:bg-slate-950/88 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => { vibrate([5]); router.back() }}
            className="p-2 -ml-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="text-center">
            <h1 className="text-[18px] font-bold text-gray-900 dark:text-gray-50">
              Detalhes
            </h1>
            <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
              Assinatura
            </p>
          </div>

          <button
            onClick={() => {
              vibrate([5])
              router.push(`/subscriptions/new?edit=${subscription.id}`)
            }}
            className="p-2 -mr-2 rounded-full text-gray-800 dark:text-gray-200 active:scale-95 transition-transform"
            aria-label="Editar assinatura"
          >
            <Pencil size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-32 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <section className="rounded-[30px] bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 shadow-[0_6px_24px_rgba(15,23,42,0.05)] dark:shadow-none p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-2">
                Nome da assinatura
              </p>
              <h2 className="text-[24px] leading-tight font-bold text-gray-900 dark:text-gray-100 break-words">
                {subscription.name || 'Assinatura'}
              </h2>
            </div>

            <div className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold ${status.bg}`}>
              <StatusIcon size={14} className={status.color} />
              <span className={status.color}>{status.label}</span>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-2">
              Valor
            </p>
            <p className="text-[34px] leading-none font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              {formatCurrency(subscription.amount || 0)}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-2">
              <Repeat size={16} className="text-gray-400" />
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                Ciclo
              </p>
            </div>
            <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
              {getBillingCycleLabel(subscription.billing_cycle)}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={16} className="text-gray-400" />
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                Próximo vencimento
              </p>
            </div>
            <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
              {formatDate(subscription.next_due_date)}
            </p>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag size={16} className="text-gray-400" />
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                Categoria
              </p>
            </div>
            <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
              {subscription.category || '—'}
            </p>
          </div>

          <div className="h-px bg-gray-100 dark:bg-slate-800" />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard size={16} className="text-gray-400" />
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                Forma de pagamento
              </p>
            </div>
            <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 break-words">
              {subscription.payment_method || '—'}
            </p>
          </div>

          <div className="h-px bg-gray-100 dark:bg-slate-800" />

          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText size={16} className="text-gray-400" />
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                Observações
              </p>
            </div>
            <p className="text-[15px] font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
              {subscription.notes || '—'}
            </p>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 rounded-[24px] p-4 border border-black/5 dark:border-white/5 shadow-sm dark:shadow-none">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mb-3">
            Informações do registro
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-gray-500 dark:text-gray-400">ID</span>
              <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 break-all text-right">
                {subscription.id}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-gray-500 dark:text-gray-400">Criado em</span>
              <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 text-right">
                {formatDate(subscription.created_at)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-gray-500 dark:text-gray-400">Atualizado em</span>
              <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 text-right">
                {formatDate(subscription.updated_at)}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#f6f7f8] dark:from-slate-950 via-[#f6f7f8]/90 dark:via-slate-950/90 to-transparent z-20">
        <button
          onClick={() => {
            vibrate([10, 50])
            router.push(`/subscriptions/new?edit=${subscription.id}`)
          }}
          className="w-full max-w-md mx-auto bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] shadow-lg shadow-teal-600/25 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Pencil size={20} />
          Editar Assinatura
        </button>
      </div>
    </div>
  )
}

export default function SubscriptionDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f6f7f8] dark:bg-slate-950">
          <Loader2 className="animate-spin text-teal-600" size={32} />
        </div>
      }
    >
      <SubscriptionDetailsContent />
    </Suspense>
  )
}