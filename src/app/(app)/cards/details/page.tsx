'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Edit2, Loader2, CreditCard,
  Calendar, Check, Clock, TrendingUp, TrendingDown, RefreshCw,
  Wallet, ArrowDown, ChevronRight, X, CheckCircle2
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { db, addToSyncQueue } from '@/lib/db'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import Skeleton from '@/components/Skeleton'

const safeNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const parsed = parseFloat(String(val).replace(',', '.').replace(/[^0-9.-]+/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

const CardDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-4 space-y-4">
    <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-[18px] bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-3">
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
      </div>
      <div className="flex justify-between">
        <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
        <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
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

  const { data: localCards, loading: cardsLoading, reload: reloadCards } = useLocalData({
    table: 'credit_cards' as any,
    filters: { id: id as string },
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { credit_card_id: id as string },
  })

  const { data: localAccounts, loading: accLoading, reload: reloadAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context },
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

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
      loadData().finally(() => setRefreshing(false))
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
  }, [loading, refreshing])

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
      const monthTxs = (localTransactions || [])
        .filter((t: any) => t.date >= start && t.date <= end)

      setTransactions(monthTxs)
      setTotalFatura(monthTxs.reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0))
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [id, user, currentMonth, localCards, localTransactions, localAccounts, reloadCards, reloadTransactions, reloadAccounts])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getLimitPercent = (used: number, limit: number) => {
    if (!limit || limit <= 0) return 0
    return Math.min((used / limit) * 100, 100)
  }

  const getLimitColor = (percent: number) => {
    if (percent >= 90) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' }
    if (percent >= 70) return { bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' }
    if (percent >= 50) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' }
    return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' }
  }

  const getBrandLabel = (brand: string | null) => {
    if (!brand) return null
    const brands: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', elo: 'Elo', amex: 'American Express', hipercard: 'Hipercard' }
    return brands[brand.toLowerCase()] || brand
  }

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
        const accUpdated = await db.table('accounts').update(targetAccount.id, { balance: newBalance })
        if (!accUpdated) throw new Error('Falha ao debitar a conta')
        await addToSyncQueue(user.id, 'accounts', 'update', targetAccount.id, { balance: newBalance })

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
          await addToSyncQueue(user.id, 'transactions', 'update', tx.id, { affects_balance: true })
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
      <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-20 font-sans transition-colors duration-300">
        <div className="flex justify-between items-center p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-10" />
        </div>
        <CardDetailSkeleton />
      </div>
    )
  }

  if (!card) return null

  const limitPercent = getLimitPercent(totalFatura, Number(card.limit_amount) || 0)
  const limitColor = getLimitColor(limitPercent)
  const available = (Number(card.limit_amount) || 0) - totalFatura
  const isNearLimit = limitPercent >= 90
  const brandLabel = getBrandLabel(card.brand)
  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: ptBR })

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

      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
      )}

      <div className="flex justify-between items-center p-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-10 border-b border-gray-100 dark:border-slate-800">
        <button onClick={() => { vibrate([5]); router.push('/cards'); }} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors active:scale-95">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-[18px] text-gray-800 dark:text-gray-100 tracking-tight">{card.name}</h1>
        <button onClick={() => { vibrate([5]); router.push(`/cards/new?edit=${card.id}`); }} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 active:scale-95">
          <Edit2 size={20} />
        </button>
      </div>

      <div className="px-4 pt-5 space-y-4 animate-in fade-in duration-300">
        <div className={`relative overflow-hidden bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border ${
          isNearLimit ? 'border-red-200 dark:border-red-800' : 'border-gray-50 dark:border-slate-700/50'
        }`}>
          <div className={`absolute top-0 left-0 right-0 h-1.5 rounded-t-[28px] ${
            isNearLimit ? 'bg-red-500' : limitPercent >= 70 ? 'bg-orange-500' : 'bg-teal-500'
          }`} />

          <div className="flex items-center gap-4 mb-5 mt-1">
            <div
              className="w-14 h-14 rounded-[18px] flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: card.color || '#f97316' }}
            >
              <CreditCard size={24} />
            </div>
            <div>
              <p className="font-black text-[18px] text-gray-800 dark:text-gray-200 leading-tight">{card.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {brandLabel && (
                  <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{brandLabel}</span>
                )}
                {card.last_four && (
                  <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500">•••• {card.last_four}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Fatura atual</p>
                <p className="text-[24px] font-black text-gray-800 dark:text-gray-200 leading-none">{formatCurrency(totalFatura)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Limite</p>
                <p className="text-[13px] font-bold text-gray-500">{formatCurrency(Number(card.limit_amount) || 0)}</p>
              </div>
            </div>
            
            <div className="w-full bg-gray-100 dark:bg-slate-700/50 rounded-full h-2.5 overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${limitColor.bar}`}
                style={{ width: `${limitPercent}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center mt-2">
              <span className={`text-[12px] font-bold ${limitColor.text}`}>
                {limitPercent.toFixed(0)}% utilizado
              </span>
              {available > 0 && (
                <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(available)} disp.
                </span>
              )}
              {available <= 0 && (
                <span className="text-[12px] font-bold text-red-500">Sem limite</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-bold text-gray-400 dark:text-gray-500 mb-5 bg-gray-50 dark:bg-slate-700/30 p-2.5 rounded-[16px] justify-center">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>Fecha dia {card.closing_day}</span>
            </div>
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>Vence dia {card.due_day}</span>
            </div>
          </div>

          {totalFatura > 0 && (
            <button
              onClick={() => { vibrate([10]); setShowPayModal(true); }}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[20px] font-bold text-[15px] transition-transform active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30"
            >
              <Wallet size={18} />
              Pagar Fatura
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 py-2">
          <button onClick={() => { vibrate([5]); setCurrentMonth(prev => addMonths(prev, -1)); }} className="p-2.5 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full active:scale-95">
            <ChevronLeft size={18} />
          </button>
          <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-wide px-2">{monthLabel}</span>
          <button onClick={() => { vibrate([5]); setCurrentMonth(prev => addMonths(prev, 1)); }} className="p-2.5 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full active:scale-95">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50">
          <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 mb-4">Transações do cartão</h3>
          {transactions.length === 0 ? (
            <div className="text-center py-6">
               <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CreditCard size={20} className="text-gray-400" />
               </div>
               <p className="text-gray-400 dark:text-gray-500 text-[13px] font-medium">Nenhuma transação neste período.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {transactions.map((tx: any, index: number) => {
                const isPending = tx.status === 'pending'
                return (
                  <div
                    key={tx.id}
                    onClick={() => { vibrate([5]); router.push(`/transactions/details?id=${tx.id}`); }}
                    className={`flex items-center justify-between p-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[20px] transition-all active:scale-[0.98] ${isPending ? 'bg-orange-50 dark:bg-orange-900/10' : ''}`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 ${isPending ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-emerald-50 dark:bg-emerald-900/30'}`}>
                        {isPending ? <Clock size={18} className="text-orange-500" /> : <Check size={18} className="text-emerald-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">{tx.description || tx.categories?.name || 'Compra'}</p>
                        <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}</p>
                      </div>
                    </div>
                    <p className="text-[15px] font-black text-red-500 flex-shrink-0">- {formatCurrency(Number(tx.amount) || 0)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Pagar Fatura - Padrão Bottom Sheet */}
      {showPayModal && (
        <div className="fixed inset-0 z-[600] flex items-end justify-center" onClick={() => setShowPayModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-t-[32px] p-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] animate-in slide-in-from-bottom-8 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full mx-auto mb-6" />
            
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-[20px] text-gray-800 dark:text-gray-100">Pagar Fatura</h3>
              <button onClick={() => { vibrate([5]); setShowPayModal(false); }} className="text-gray-400 bg-gray-100 dark:bg-slate-700 p-2 rounded-full active:scale-95"><X size={20} /></button>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700/40 border border-gray-100 dark:border-slate-700/50 rounded-[24px] p-5 mb-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest">Cartão</span>
                <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">{card.name}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest">Vencimento</span>
                <span className="text-[14px] font-bold text-gray-800 dark:text-gray-200">Dia {card.due_day}</span>
              </div>
              <div className="h-px w-full bg-gray-200 dark:bg-slate-600 my-3" />
              <div className="flex justify-between items-center">
                <span className="text-[13px] font-bold text-gray-500 uppercase tracking-widest">Valor da fatura</span>
                <span className="text-[20px] font-black text-red-500">{formatCurrency(totalFatura)}</span>
              </div>
            </div>

            <p className="text-[13px] font-medium text-gray-500 mb-6 px-2 text-center">
              O valor será debitado da sua conta de pagamento padrão e as transações do cartão passarão a afetar seu saldo principal.
            </p>

            <button
              onClick={() => { vibrate([10, 50]); handlePayFatura(); }}
              disabled={paying}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-[24px] font-bold text-[16px] disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-teal-600/30 active:scale-[0.98] transition-all"
            >
              {paying ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle2 size={22} />}
              {paying ? 'Processando...' : 'Confirmar Pagamento'}
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
