'use client'

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, ChevronRight, Edit2, RefreshCw, Image, Paperclip,
  Clock, AlertTriangle, CheckCircle, ArrowLeft, Calendar, Wallet, TrendingUp, TrendingDown,
  Trash2, X  // ✅ ADICIONEI Trash2 e X
} from 'lucide-react'
import { format, subMonths, addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useBudgetById } from '@/hooks/useBudgetById'
import { useBudgetTransactions } from '@/hooks/useBudgetTransactions'
import { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { useToast } from '@/contexts/ToastContext'
import { useSafeDb } from '@/hooks/useSafeDb'
import { db } from '@/lib/db'
import Skeleton from '@/components/Skeleton'

// ============================================================
// COMPONENTES VISUAIS
// ============================================================

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="border-b border-gray-100 dark:border-slate-800 pb-3">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
  )
}

function MetricCard({ label, value, color = 'gray' }: { label: string; value: string; color?: 'gray' | 'red' | 'green' | 'orange' }) {
  const colorMap = {
    gray: 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700/70 text-gray-900 dark:text-gray-100',
    red: 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400',
    green: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    orange: 'bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20 text-orange-600 dark:text-orange-400',
  }

  return (
    <div className={`rounded-[20px] border p-3.5 ${colorMap[color]}`}>
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-[15px] font-bold">{value}</p>
    </div>
  )
}

function StatusBadge({ status, isOverBudget, isWarning }: { status: string; isOverBudget: boolean; isWarning: boolean }) {
  const config = isOverBudget
    ? { bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-200 dark:border-red-500/20', text: 'text-red-600 dark:text-red-400', icon: AlertTriangle, label: 'Orçamento estourado' }
    : isWarning
    ? { bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20', text: 'text-orange-600 dark:text-orange-400', icon: AlertTriangle, label: 'Atenção ao limite' }
    : { bg: 'bg-emerald-50 dark:bg-emerald-500/10', border: 'border-emerald-200 dark:border-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle, label: 'Dentro do limite' }

  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold border ${config.bg} ${config.border} ${config.text}`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}

// ============================================================
// SKELETON
// ============================================================

const BudgetDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6">
    <div className="flex items-center justify-between mb-6">
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-2xl" />
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded-full" />
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-2xl" />
    </div>

    <div className="flex items-center justify-center mb-5">
      <div className="h-11 w-48 bg-gray-200 dark:bg-slate-700 rounded-full" />
    </div>

    <div className="rounded-[28px] border border-gray-100 dark:border-slate-700/60 bg-white dark:bg-slate-800 p-5 shadow-sm mb-4">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-[18px] bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-5 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/60 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[18px] p-3 bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/60">
            <div className="h-3 w-12 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
          </div>
        ))}
      </div>

      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
      </div>
    </div>
  </div>
)

// ============================================================
// MODAL DE CONFIRMAÇÃO
// ============================================================

function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-t-[32px] bg-white dark:bg-slate-900 p-6 animate-in slide-in-from-bottom-8 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300 dark:bg-slate-700" />

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Excluir orçamento</h3>
          <button
            onClick={onClose}
            className="rounded-full bg-gray-100 p-2 text-gray-400 active:scale-95 dark:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-[14px] font-medium leading-relaxed text-gray-500 dark:text-gray-400 mb-6">
          Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="rounded-[20px] border border-gray-200 bg-white py-3 text-[14px] font-bold text-gray-700 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
          >
            Cancelar
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            className="rounded-[20px] bg-red-500 py-3 text-[14px] font-bold text-white shadow-lg shadow-red-500/25 active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

function BudgetDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const { context } = useContext_()
  const { vibrate } = useHapticFeedback()
  const { showToast } = useToast()
  const { safeDelete } = useSafeDb()

  // ✅ NORMALIZA O ID
  const rawBudgetId = searchParams?.get('id')
  const budgetId = useMemo(() => rawBudgetId?.trim() || null, [rawBudgetId])

  // ✅ HOOKS NO TOPO
  const { data: budgetData, loading: budgetLoading, notFound } = useBudgetById(budgetId)
  const { data: budgetTransactions, loading: txLoading } = useBudgetTransactions(budgetId)

  // ✅ STATES
  const [currentDate, setCurrentDate] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const hasScheduledRedirect = useRef(false)

  // ✅ REDIRECIONAMENTO CONTROLADO
  useEffect(() => {
    if (!budgetId) return
    if (budgetLoading) return
    if (!notFound) return
    if (hasScheduledRedirect.current) return

    hasScheduledRedirect.current = true

    const timer = setTimeout(() => {
      router.replace('/budgets')
    }, 1500)

    return () => clearTimeout(timer)
  }, [budgetId, budgetLoading, notFound, router])

  // ✅ FUNÇÃO DE EXCLUIR
  const handleDelete = async () => {
    if (!user?.id || !budgetId) return
    setDeleting(true)

    try {
      const result = await safeDelete('budgets', budgetId)
      if (!result.success) throw new Error(result.error || 'Erro ao excluir')

      showToast('✅ Orçamento excluído com sucesso!', 'success')
      router.replace('/budgets')
    } catch (err: any) {
      showToast(`❌ Erro ao excluir: ${err.message}`, 'error')
      setShowDeleteModal(false)
    } finally {
      setDeleting(false)
    }
  }

  // ✅ useMemo PARA DADOS DERIVADOS
  const { spent, transactions, remaining, percent, isOverBudget, isWarning, daysLeft, projection } = useMemo(() => {
    if (!budgetData || !budgetTransactions) {
      return {
        spent: 0,
        transactions: [],
        remaining: 0,
        percent: 0,
        isOverBudget: false,
        isWarning: false,
        daysLeft: null,
        projection: '⏳ Carregando dados...'
      }
    }

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const daysPassed = differenceInDays(new Date(), startOfMonth(currentDate)) + 1

    let filteredTxs = budgetTransactions.filter(
      (tx: any) => tx && tx.date >= start && tx.date <= end && tx.status === 'done'
    )

    if (budgetData.category_id) {
      filteredTxs = filteredTxs.filter((tx: any) => tx.category_id === budgetData.category_id)
    }

    const totalSpent = filteredTxs
      .filter((tx: any) => tx.type === 'expense' || tx.type === 'sangria')
      .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)

    const remainingVal = Number(budgetData.amount) - totalSpent
    const percentVal = Number(budgetData.amount) > 0 ? (totalSpent / Number(budgetData.amount)) * 100 : 0
    const isOver = remainingVal < 0
    const isWarn = percentVal >= 75 && percentVal < 100

    let daysLeftVal: number | null = null
    let projectionVal = '✅ Nenhum gasto registrado ainda.'

    if (totalSpent > 0 && remainingVal > 0) {
      const dailyAverage = daysPassed > 0 ? totalSpent / daysPassed : 0
      if (dailyAverage > 0) {
        daysLeftVal = Math.floor(remainingVal / dailyAverage)
        if (daysLeftVal <= 3) {
          projectionVal = `⚠️ Neste ritmo, o orçamento acabará em ${daysLeftVal} dia(s)!`
        } else if (daysLeftVal <= 7) {
          projectionVal = `⚠️ Neste ritmo, dura mais ${daysLeftVal} dias.`
        } else {
          projectionVal = `✅ Ritmo tranquilo! Dura mais ${daysLeftVal} dias.`
        }
      }
    } else if (remainingVal <= 0) {
      daysLeftVal = 0
      projectionVal = '🔴 Orçamento estourado!'
    }

    return {
      spent: totalSpent,
      transactions: filteredTxs,
      remaining: remainingVal,
      percent: Math.min(percentVal, 100),
      isOverBudget: isOver,
      isWarning: isWarn,
      daysLeft: daysLeftVal,
      projection: projectionVal
    }
  }, [budgetData, budgetTransactions, currentDate])

  // ✅ RETURNS CONDICIONAIS
  if (!budgetId) {
    router.replace('/budgets')
    return null
  }

  if (budgetLoading) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f6f7f8] dark:bg-slate-950 pb-24 font-sans transition-colors duration-300">
        <div className="flex items-center justify-between px-4 pt-6 mb-2">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
          <div className="h-5 w-28 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
        </div>
        <BudgetDetailSkeleton />
      </div>
    )
  }

  if (notFound || !budgetData) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f6f7f8] dark:bg-slate-950 flex flex-col items-center justify-center px-4">
        <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">Orçamento não encontrado</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs mb-6">
          O orçamento que você está tentando acessar pode ter sido excluído ou você não tem permissão.
        </p>
        <button
          onClick={() => router.push('/budgets')}
          className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-full font-semibold transition-colors active:scale-95"
        >
          Voltar para listagem
        </button>
      </div>
    )
  }

  // ✅ RENDERIZAÇÃO
  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
  const IconComp = getDynamicIcon(budgetData?.icon || 'tag')
  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`

  const getAttachmentIcon = (url: string | null) => {
    if (!url) return null
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
    if (isImage) return <Image size={12} className="shrink-0 text-blue-500" />
    return <Paperclip size={12} className="shrink-0 text-slate-400" />
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-950 px-4 pt-4 pb-28 font-sans transition-colors duration-300">
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-5 pointer-events-none">
          <div className="rounded-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl px-4 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-gray-100 dark:border-slate-700/60 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={15} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-700 dark:text-teal-400">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-20 -mx-4 px-4 pt-2 pb-4 bg-[#f8f9fa]/92 dark:bg-slate-950/92 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              vibrate([5])
              router.push('/budgets')
            }}
            className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-gray-800 dark:text-gray-200 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <ArrowLeft size={22} />
          </button>

          <div className="px-4 text-center min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-[0.16em]">
              Detalhes do orçamento
            </p>
            <h1 className="text-[18px] font-bold text-gray-900 dark:text-gray-100 truncate">
              {budgetData.name}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            {/* ✅ BOTÃO EXCLUIR */}
            <button
              onClick={() => setShowDeleteModal(true)}
              className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-red-500 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
            >
              <Trash2 size={18} />
            </button>

            {/* ✅ BOTÃO EDITAR */}
            <button
              onClick={() => {
                vibrate([5])
                router.push(`/budgets/new?edit=${budgetData.id}`)
              }}
              className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 text-teal-700 dark:text-teal-400 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
            >
              <Edit2 size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-1.5 shadow-sm">
            <button
              onClick={() => {
                vibrate([5])
                setCurrentDate(subMonths(currentDate, 1))
              }}
              className="w-9 h-9 rounded-full bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="min-w-[120px] text-center text-[13px] font-semibold text-gray-800 dark:text-gray-200 capitalize px-2">
              {monthLabel}
            </span>

            <button
              onClick={() => {
                vibrate([5])
                setCurrentDate(addMonths(currentDate, 1))
              }}
              className="w-9 h-9 rounded-full bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 flex items-center justify-center active:scale-95 transition-transform"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex justify-center">
        <StatusBadge status={budgetData.status} isOverBudget={isOverBudget} isWarning={isWarning} />
      </div>

      <section className="rounded-[30px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-[0_10px_30px_rgba(15,23,42,0.04)] mb-4 overflow-hidden">
        <div className="p-5 pb-4">
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-14 h-14 rounded-[18px] flex items-center justify-center shadow-sm"
              style={{ backgroundColor: `${budgetData.color}18`, color: budgetData.color }}
            >
              <IconComp size={24} />
            </div>

            <div className="min-w-0">
              <h2 className="text-[19px] font-bold text-gray-900 dark:text-gray-100 leading-tight">
                {budgetData.name}
              </h2>
              <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 mt-1">
                {budgetData.categories?.name || 'Geral'} •{' '}
                {budgetData.period === 'monthly'
                  ? 'Mensal'
                  : budgetData.period === 'biweekly'
                    ? 'Quinzenal'
                    : 'Semanal'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <MetricCard label="Orçado" value={formatCurrency(Number(budgetData.amount))} color="gray" />
            <MetricCard label="Gasto" value={formatCurrency(spent)} color="red" />
            <MetricCard
              label="Restante"
              value={formatCurrency(Math.abs(remaining))}
              color={remaining >= 0 ? 'green' : 'red'}
            />
          </div>

          <div className="mb-2">
            <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  isOverBudget ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-teal-500'
                }`}
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[12px] text-gray-500 dark:text-gray-400">Consumo do período</p>
            <p
              className={`text-[12px] font-semibold ${
                isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {percent.toFixed(1)}% utilizado
            </p>
          </div>
        </div>
      </section>

      {projection && (
        <div
          className={`rounded-[24px] p-4 mb-4 border flex items-start gap-3 ${
            isOverBudget
              ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
              : isWarning || (daysLeft !== null && daysLeft <= 7)
                ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-700 dark:text-orange-400'
                : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
          }`}
        >
          <div className="mt-0.5 shrink-0">
            {isOverBudget ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.16em] opacity-70 mb-1">
              Projeção
            </p>
            <p className="text-[13px] font-semibold leading-snug">{projection}</p>
          </div>
        </div>
      )}

      <section className="rounded-[30px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 dark:border-slate-800">
          <h3 className="text-[16px] font-bold text-gray-900 dark:text-gray-100">
            Transações deste orçamento
          </h3>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
            Gastos concluídos vinculados a este período.
          </p>
        </div>

        {txLoading ? (
          <div className="py-10 px-5 text-center">
            <div className="flex justify-center">
              <RefreshCw size={24} className="animate-spin text-teal-500" />
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-10 px-5 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3">
              <Clock size={20} className="text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-[14px] font-medium text-gray-500 dark:text-gray-400">
              Nenhum gasto registrado neste mês.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {transactions.map((tx: any) => {
              const TxIconComp = getDynamicIcon(tx.categories?.icon || 'tag')
              const isPending = tx.status === 'pending'
              const attachmentIcon = getAttachmentIcon(tx.receipt_url)

              return (
                <button
                  key={tx.id}
                  onClick={() => {
                    vibrate([5])
                    router.push(`/transactions/details?id=${tx.id}`)
                  }}
                  className={`w-full text-left px-5 py-4 flex items-center gap-3 active:scale-[0.99] transition-transform ${
                    isPending ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'bg-transparent'
                  }`}
                >
                  <div
                    className={`w-11 h-11 rounded-[16px] flex items-center justify-center shrink-0 ${
                      isPending
                        ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-500'
                        : 'bg-red-50 dark:bg-red-900/30 text-red-500'
                    }`}
                  >
                    <TxIconComp size={18} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {tx.description || tx.categories?.name}
                      </p>
                      {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
                    </div>

                    <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">
                      {format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[15px] font-bold text-red-600 dark:text-red-400">
                      - {formatCurrency(Number(tx.amount) || 0)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ✅ MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <ConfirmDeleteModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  )
}

export default function BudgetDetailPage() {
  return (
    <Suspense fallback={<BudgetDetailSkeleton />}>
      <BudgetDetailContent />
    </Suspense>
  )
}