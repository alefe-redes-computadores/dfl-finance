'use client'

import { useEffect, useState, useCallback, useRef, Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft,
  Edit2,
  Loader2,
  CreditCard,
  Calendar,
  Check,
  Clock,
  RefreshCw,
  Wallet,
  ChevronRight,
  X,
  CheckCircle2,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { db, addToSyncQueue } from '@/lib/db'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'

const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

const formatCurrency = (val: number) =>
  `R$ ${(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const getLimitPercent = (used: number, limit: number) => {
  if (!limit || limit <= 0) return 0
  return Math.min((used / limit) * 100, 100)
}

const getLimitColor = (percent: number) => {
  if (percent >= 90) {
    return {
      bar: 'bg-red-500',
      text: 'text-red-600 dark:text-red-400',
      soft: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800/60',
    }
  }

  if (percent >= 70) {
    return {
      bar: 'bg-orange-500',
      text: 'text-orange-600 dark:text-orange-400',
      soft: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800/60',
    }
  }

  if (percent >= 50) {
    return {
      bar: 'bg-amber-500',
      text: 'text-amber-600 dark:text-amber-400',
      soft: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800/60',
    }
  }

  return {
    bar: 'bg-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    soft: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800/60',
  }
}

const getBrandLabel = (brand: string | null) => {
  if (!brand) return null

  const brands: Record<string, string> = {
    visa: 'Visa',
    mastercard: 'Mastercard',
    elo: 'Elo',
    amex: 'American Express',
    hipercard: 'Hipercard',
  }

  return brands[brand.toLowerCase()] || brand
}

const CardDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-4 space-y-4">
    <div className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
      <div className="mb-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-[18px] bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-5 w-32 rounded bg-gray-200 dark:bg-slate-700" />
          <div className="h-3 w-24 rounded bg-gray-100 dark:bg-slate-700/50" />
        </div>
      </div>
      <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
        <div className="h-full w-2/3 rounded-full bg-gray-200 dark:bg-slate-600" />
      </div>
      <div className="flex justify-between">
        <div className="h-3 w-24 rounded bg-gray-100 dark:bg-slate-700/50" />
        <div className="h-3 w-20 rounded bg-gray-100 dark:bg-slate-700/50" />
      </div>
    </div>
  </div>
)

function CardDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()
  const { vibrate, success, error: hapticError } = useHapticFeedback()

  const [card, setCard] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [totalFatura, setTotalFatura] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showPayModal, setShowPayModal] = useState(false)
  const [paying, setPaying] = useState(false)

  const { data: localCards, reload: reloadCards } = useLocalData({
    table: 'credit_cards' as any,
    filters: { id: id as string },
  })

  const { data: localTransactions, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { credit_card_id: id as string },
  })

  const { data: localAccounts, reload: reloadAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context },
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (window.scrollY > 10 || loading) return
      pullStartY.current = e.touches[0].clientY
      isPulling.current = true
    },
    [loading]
  )

  const handleTouchEnd = useCallback(() => {
    isPulling.current = false
  }, [])

  const loadData = useCallback(async () => {
    if (!id || !user?.id) return

    setLoading(true)
    setLoadingPulse(true)

    try {
      await Promise.all([reloadCards(), reloadTransactions(), reloadAccounts()])

      const cardData = (localCards || [])[0] as any
      if (cardData) setCard(cardData)

      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')

      const monthTxs = (localTransactions || []).filter(
        (t: any) => t.date >= start && t.date <= end
      )

      setTransactions(monthTxs)
      setTotalFatura(
        monthTxs.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0)
      )
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [
    id,
    user?.id,
    currentMonth,
    localCards,
    localTransactions,
    reloadCards,
    reloadTransactions,
    reloadAccounts,
  ])

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPulling.current || refreshing) return

      const pullDistance = e.touches[0].clientY - pullStartY.current

      if (pullDistance > 60) {
        setRefreshing(true)
        isPulling.current = false
        vibrate([10])
        loadData().finally(() => setRefreshing(false))
      }
    },
    [refreshing, vibrate, loadData]
  )

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
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  useEffect(() => {
    loadData()
  }, [loadData])

  const limitPercent = useMemo(
    () => getLimitPercent(totalFatura, Number(card?.limit_amount) || 0),
    [totalFatura, card?.limit_amount]
  )

  const limitColor = useMemo(() => getLimitColor(limitPercent), [limitPercent])

  const available = useMemo(
    () => (Number(card?.limit_amount) || 0) - totalFatura,
    [card?.limit_amount, totalFatura]
  )

  const isNearLimit = limitPercent >= 90

  const brandLabel = useMemo(() => getBrandLabel(card?.brand || null), [card?.brand])

  const monthLabel = useMemo(
    () => format(currentMonth, 'MMMM yyyy', { locale: ptBR }),
    [currentMonth]
  )

  const handlePayFatura = async () => {
    if (!user?.id || !card) return

    setPaying(true)

    try {
      const accounts = (localAccounts || []) as any[]
      const targetAccount = accounts.find((a) => a.id === card.payment_account_id) || accounts[0]

      if (!targetAccount) {
        showToast('Crie uma conta primeiro.', 'warning')
        hapticError()
        setPaying(false)
        return
      }

      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')
      const allTxs = (localTransactions || []) as any[]
      const cardTxs = allTxs.filter((t: any) => t.date >= start && t.date <= end)

      await db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
        const freshAccount = await db.table('accounts').get(targetAccount.id)
        if (!freshAccount) throw new Error('Conta de pagamento não encontrada')

        const newBalance = safeNum(freshAccount.balance) - totalFatura
        const accUpdated = await db.table('accounts').update(targetAccount.id, {
          balance: newBalance,
        })

        if (!accUpdated) throw new Error('Falha ao debitar a conta')

        await addToSyncQueue(user.id, 'accounts', 'update', targetAccount.id, {
          balance: newBalance,
        })

        const txId = crypto.randomUUID()
        const txPayload = {
          id: txId,
          user_id: user.id,
          type: 'expense',
          amount: totalFatura,
          description: `Pagamento fatura ${card.name}`,
          account_id: targetAccount.id,
          credit_card_id: card.id,
          date: format(new Date(), 'yyyy-MM-dd'),
          status: 'done',
          context: card.context,
          affects_balance: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sync_status: 'pending',
          sync_attempts: 0,
        }

        await db.table('transactions').add(txPayload)
        await addToSyncQueue(user.id, 'transactions', 'create', txId, txPayload)

        for (const tx of cardTxs) {
          await db.table('transactions').update(tx.id, { affects_balance: true })
          await addToSyncQueue(user.id, 'transactions', 'update', tx.id, {
            affects_balance: true,
          })
        }
      })

      success()
      showToast('✅ Fatura paga com sucesso!', 'success')
      setShowPayModal(false)
      loadData()
    } catch (err: any) {
      hapticError()
      showToast(`Erro ao pagar: ${err.message}`, 'error')
    } finally {
      setPaying(false)
    }
  }

  if (loading && !card) {
    return (
      <div className="mx-auto min-h-screen max-w-md bg-gray-50 pb-20 font-sans transition-colors duration-300 dark:bg-slate-900">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/90 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200 dark:bg-slate-700" />
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-slate-700" />
          <div className="w-10" />
        </div>
        <CardDetailSkeleton />
      </div>
    )
  }

  if (!card) return null

  return (
    <div
      ref={containerRef}
      className="mx-auto min-h-screen max-w-md bg-gray-50 pb-24 font-sans transition-colors duration-300 dark:bg-slate-900"
    >
      {refreshing && (
        <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center pt-6">
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.1)] animate-in slide-in-from-top-2 duration-300 dark:bg-slate-800">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {loadingPulse && (
        <div className="fixed right-4 top-20 z-50">
          <div className="h-3 w-3 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)] animate-pulse" />
        </div>
      )}

      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/90 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/90">
        <button
          onClick={() => {
            vibrate([5])
            router.push('/cards')
          }}
          className="rounded-full p-2 -ml-2 text-gray-800 transition-colors active:scale-95 dark:text-gray-200"
        >
          <ChevronLeft size={24} />
        </button>

        <h1 className="truncate px-3 text-[18px] font-bold tracking-tight text-gray-800 dark:text-gray-100">
          {card.name}
        </h1>

        <button
          onClick={() => {
            vibrate([5])
            router.push(`/cards/new?edit=${card.id}`)
          }}
          className="rounded-full p-2 -mr-2 text-teal-700 active:scale-95 dark:text-teal-400"
        >
          <Edit2 size={20} />
        </button>
      </div>

      <div className="animate-in space-y-4 px-4 pt-5 fade-in duration-300">
        <div
          className={`relative overflow-hidden rounded-[28px] border bg-white p-6 shadow-sm dark:bg-slate-800 ${
            isNearLimit
              ? 'border-red-200 dark:border-red-800/70'
              : 'border-gray-100 dark:border-slate-700/50'
          }`}
        >
          <div
            className={`absolute left-0 right-0 top-0 h-1.5 rounded-t-[28px] ${
              isNearLimit ? 'bg-red-500' : limitPercent >= 70 ? 'bg-orange-500' : 'bg-teal-500'
            }`}
          />

          <div className="mt-1 mb-5 flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[18px] text-white shadow-sm"
              style={{ backgroundColor: card.color || '#f97316' }}
            >
              <CreditCard size={24} />
            </div>

            <div className="min-w-0">
              <p className="truncate text-[18px] font-black leading-tight text-gray-800 dark:text-gray-200">
                {card.name}
              </p>

              <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
                {brandLabel && <span className="font-semibold">{brandLabel}</span>}
                {card.last_four && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <span className="font-medium">•••• {card.last_four}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="mb-1 text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Fatura atual
                </p>
                <p className="leading-none text-[28px] font-black tracking-tight text-gray-900 dark:text-gray-100">
                  {formatCurrency(totalFatura)}
                </p>
              </div>

              <div className="text-right">
                <p className="mb-1 text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Limite
                </p>
                <p className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">
                  {formatCurrency(Number(card.limit_amount) || 0)}
                </p>
              </div>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 shadow-inner dark:bg-slate-700/50">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${limitColor.bar}`}
                style={{ width: `${limitPercent}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <span className={`text-[12px] font-semibold ${limitColor.text}`}>
                {limitPercent.toFixed(0)}% utilizado
              </span>

              {available > 0 ? (
                <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(available)} disponível
                </span>
              ) : (
                <span className="text-[12px] font-semibold text-red-500">Sem limite disponível</span>
              )}
            </div>
          </div>

          <div
            className={`mb-5 flex items-center justify-center gap-3 rounded-[18px] border px-3 py-3 text-[12px] ${
              limitColor.soft
            } ${isNearLimit ? limitColor.border : 'border-gray-100 dark:border-slate-700/50'}`}
          >
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <Calendar size={14} />
              <span className="font-medium">Fecha dia {card.closing_day}</span>
            </div>

            <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />

            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <Calendar size={14} />
              <span className="font-medium">Vence dia {card.due_day}</span>
            </div>
          </div>

          {totalFatura > 0 && (
            <button
              onClick={() => {
                vibrate([10])
                setShowPayModal(true)
              }}
              className="flex w-full items-center justify-center gap-2 rounded-[20px] bg-teal-600 py-4 text-[15px] font-bold text-white shadow-lg shadow-teal-600/30 transition-transform active:scale-[0.98] hover:bg-teal-700"
            >
              <Wallet size={18} />
              Pagar fatura
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 py-1">
          <button
            onClick={() => {
              vibrate([5])
              setCurrentMonth((prev) => addMonths(prev, -1))
            }}
            className="rounded-full border border-gray-100 bg-white p-2.5 text-gray-400 shadow-sm transition-colors active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:hover:text-gray-300"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="min-w-[170px] rounded-full border border-gray-100 bg-white px-4 py-2 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <span className="text-[14px] font-semibold capitalize tracking-[0.01em] text-gray-800 dark:text-gray-200">
              {monthLabel}
            </span>
          </div>

          <button
            onClick={() => {
              vibrate([5])
              setCurrentMonth((prev) => addMonths(prev, 1))
            }}
            className="rounded-full border border-gray-100 bg-white p-2.5 text-gray-400 shadow-sm transition-colors active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:hover:text-gray-300"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="rounded-[28px] border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-700/50 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-bold text-gray-800 dark:text-gray-100">
              Transações do cartão
            </h3>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-slate-700/60 dark:text-gray-300">
              {transactions.length}
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 dark:bg-slate-700/50">
                <CreditCard size={20} className="text-gray-400" />
              </div>
              <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500">
                Nenhuma transação neste período.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => {
                const isPending = tx.status === 'pending'

                return (
                  <button
                    key={tx.id}
                    onClick={() => {
                      vibrate([5])
                      router.push(`/transactions/details?id=${tx.id}`)
                    }}
                    className={`flex w-full items-center justify-between rounded-[20px] border px-3.5 py-3.5 text-left transition-all active:scale-[0.98] ${
                      isPending
                        ? 'border-orange-100 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-900/10'
                        : 'border-transparent bg-gray-50/70 dark:bg-slate-700/30'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] ${
                          isPending
                            ? 'bg-orange-100 dark:bg-orange-900/30'
                            : 'bg-emerald-50 dark:bg-emerald-900/30'
                        }`}
                      >
                        {isPending ? (
                          <Clock size={18} className="text-orange-500" />
                        ) : (
                          <Check size={18} className="text-emerald-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                          {tx.description || tx.categories?.name || 'Compra'}
                        </p>
                        <p className="mt-0.5 text-[12px] font-medium text-gray-400 dark:text-gray-500">
                          {format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}
                        </p>
                      </div>
                    </div>

                    <p className="ml-3 flex-shrink-0 text-[15px] font-black text-red-500">
                      - {formatCurrency(Number(tx.amount) || 0)}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showPayModal && (
        <div
          className="fixed inset-0 z-[600] flex items-end justify-center"
          onClick={() => setShowPayModal(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />

          <div
            className="relative w-full max-w-lg rounded-t-[32px] bg-white p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-slate-700" />

            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">
                Pagar fatura
              </h3>

              <button
                onClick={() => {
                  vibrate([5])
                  setShowPayModal(false)
                }}
                className="rounded-full bg-gray-100 p-2 text-gray-400 active:scale-95 dark:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5 rounded-[24px] border border-gray-100 bg-gray-50 p-5 dark:border-slate-700/50 dark:bg-slate-700/40">
              <div className="mb-3 flex items-center justify-between gap-4">
                <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Cartão
                </span>
                <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                  {card.name}
                </span>
              </div>

              <div className="mb-3 flex items-center justify-between gap-4">
                <span className="text-[12px] font-medium text-gray-500 dark:text-gray-400">
                  Vencimento
                </span>
                <span className="text-[14px] font-semibold text-gray-800 dark:text-gray-200">
                  Dia {card.due_day}
                </span>
              </div>

              <div className="my-3 h-px w-full bg-gray-200 dark:bg-slate-600" />

              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
                  Valor da fatura
                </span>
                <span className="text-[22px] font-black tracking-tight text-red-500">
                  {formatCurrency(totalFatura)}
                </span>
              </div>
            </div>

            <p className="mb-6 px-2 text-center text-[13px] font-medium leading-relaxed text-gray-500 dark:text-gray-400">
              O valor será debitado da sua conta de pagamento padrão e as transações do
              cartão passarão a afetar seu saldo principal.
            </p>

            <button
              onClick={() => {
                vibrate([10, 50])
                handlePayFatura()
              }}
              disabled={paying}
              className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-teal-600 py-4 text-[16px] font-bold text-white shadow-lg shadow-teal-600/30 transition-all active:scale-[0.98] disabled:opacity-50 hover:bg-teal-700"
            >
              {paying ? (
                <Loader2 size={22} className="animate-spin" />
              ) : (
                <CheckCircle2 size={22} />
              )}
              {paying ? 'Processando...' : 'Confirmar pagamento'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CardDetailPage() {
  return (
    <Suspense fallback={<CardDetailSkeleton />}>
      <CardDetailContent />
    </Suspense>
  )
}