'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Edit2, Trash2, Loader2, CreditCard, AlertTriangle,
  Calendar, CheckCircle2, TrendingUp, TrendingDown, RefreshCw,
  Wallet, ArrowUp, ArrowDown, ChevronRight, X, Check, Clock, Building2
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'

const CardDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-4 space-y-4">
    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-3">
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
      </div>
      <div className="flex justify-between">
        <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
        <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-2" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded mx-auto mb-2" />
        <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded mx-auto" />
      </div>
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50 dark:border-slate-700 last:border-0">
          <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700" />
          <div className="w-10 h-10 rounded-[12px] bg-gray-100 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 bg-gray-100 dark:bg-slate-700 rounded" />
            <div className="h-2.5 w-1/2 bg-gray-100 dark:bg-slate-700 rounded" />
          </div>
          <div className="h-4 w-16 bg-gray-100 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  </div>
)

export default function CardDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [card, setCard] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [totalFatura, setTotalFatura] = useState(0)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [showPayModal, setShowPayModal] = useState(false)
  const [paying, setPaying] = useState(false)

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB) - CORRIGIDO
  // ============================================================
  const { data: localCards, loading: cardsLoading, reload: reloadCards } = useLocalData({
    table: 'credit_cards' as any,
    filters: { id: id as string },
    realtime: true,
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { credit_card_id: id as string },
    orderBy: { field: 'date', direction: 'desc' },
    realtime: true,
  })

  const { data: localAccounts, loading: accLoading, reload: reloadAccounts } = useLocalData({
    table: 'accounts' as any,
    filters: { context },
    realtime: false,
  })

  // Hooks CRUD no topo
  const { update: updateAccount } = useLocalData({ table: 'accounts' as any })
  const { create: createTransaction, update: updateTransaction } = useLocalData({ table: 'transactions' as any })

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
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
      loadData().finally(() => setRefreshing(false))
    }
  }

  const handleTouchEnd = () => {
    isPulling.current = false
  }

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

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadData = useCallback(async () => {
    if (!id || !user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      await Promise.all([reloadCards(), reloadTransactions(), reloadAccounts()])

      const cardData = (localCards || [])[0] as any
      if (cardData) {
        setCard(cardData)
      }

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

  // ============================================================
  // FUNÇÕES AUXILIARES
  // ============================================================
  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getLimitPercent = (used: number, limit: number) => {
    if (!limit || limit <= 0) return 0
    return Math.min((used / limit) * 100, 100)
  }

  const getLimitColor = (percent: number) => {
    if (percent >= 90) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' }
    if (percent >= 70) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' }
    if (percent >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30' }
    return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/30' }
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

  // ============================================================
  // 🔥 PAGAR FATURA (COM HOOK LOCAL)
  // ============================================================
  const handlePayFatura = async () => {
    if (!user?.id || !card) return
    setPaying(true)

    try {
      const accounts = localAccounts || []
      const targetAccount = accounts[0] as any
      if (!targetAccount) {
        showToast('Crie uma conta primeiro.', 'warning')
        setPaying(false)
        return
      }

      // 1. Atualizar saldo da conta
      await updateAccount(targetAccount.id, {
        balance: Number(targetAccount.balance) - totalFatura
      })

      // 2. Criar transação de pagamento
      await createTransaction({
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
      })

      // 3. Atualizar transações do cartão (afetam saldo)
      const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd')
      const cardTxs = ((localTransactions || []) as any[]).filter((t: any) => t.date >= start && t.date <= end)

      for (const tx of cardTxs) {
        await updateTransaction(tx.id, { affects_balance: true })
      }

      showToast('Fatura paga com sucesso!', 'success')
      setShowPayModal(false)
      loadData()
    } catch (err: any) {
      showToast(`Erro ao pagar: ${err.message}`, 'error')
    } finally {
      setPaying(false)
    }
  }

  if (loading && !card) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans transition-colors duration-300">
        <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-50 dark:border-slate-700">
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
          <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="w-10" />
        </div>
        <CardDetailSkeleton />
      </div>
    )
  }

  if (!card) return null

  const limitPercent = getLimitPercent(totalFatura, Number(card.credit_limit) || 0)
  const limitColor = getLimitColor(limitPercent)
  const available = (Number(card.credit_limit) || 0) - totalFatura
  const isNearLimit = limitPercent >= 90
  const brandLabel = getBrandLabel(card.brand)
  const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: ptBR })

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans transition-colors duration-300">
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 sticky top-0 z-10 border-b border-gray-50 dark:border-slate-700">
        <button onClick={() => router.push('/cards')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-bold text-[17px] text-gray-800 dark:text-gray-100">{card.name}</h1>
        <button onClick={() => router.push(`/cards/${card.id}/edit`)} className="p-2 -mr-2 text-teal-700 dark:text-teal-400">
          <Edit2 size={20} />
        </button>
      </div>

      <div className="px-4 pt-4 space-y-4 animate-in fade-in duration-300">
        <div className={`relative overflow-hidden bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border ${
          isNearLimit ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-slate-700'
        }`}>
          <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-[24px] ${
            isNearLimit ? 'bg-red-500' : limitPercent >= 70 ? 'bg-amber-500' : 'bg-teal-500'
          }`} />

          <div className="flex items-center gap-3 mb-4 mt-1">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: card.color || '#f97316' }}
            >
              <CreditCard size={22} />
            </div>
            <div>
              <p className="font-bold text-[16px] text-gray-800 dark:text-gray-200">{card.name}</p>
              <div className="flex items-center gap-2">
                {brandLabel && (
                  <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">{brandLabel}</span>
                )}
                {card.last_digits && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">•••• {card.last_digits}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="font-medium text-gray-500 dark:text-gray-400">
                Fatura atual: <span className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(totalFatura)}</span>
              </span>
              <span className="font-medium text-gray-400 dark:text-gray-500">
                Limite: {formatCurrency(Number(card.credit_limit) || 0)}
              </span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${limitColor.bar}`}
                style={{ width: `${limitPercent}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1.5">
              <span className={`text-[11px] font-bold ${limitColor.text}`}>
                {limitPercent.toFixed(0)}% utilizado
              </span>
              {available > 0 && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(available)} disponível
                </span>
              )}
              {available <= 0 && (
                <span className="text-[11px] font-medium text-red-500">Sem limite disponível</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-gray-400 dark:text-gray-500 mb-4">
            <div className="flex items-center gap-1.5">
              <Calendar size={12} />
              <span>Fecha dia {card.closing_day}</span>
            </div>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-1.5">
              <Calendar size={12} />
              <span>Vence dia {card.due_day}</span>
            </div>
          </div>

          {totalFatura > 0 && (
            <button
              onClick={() => setShowPayModal(true)}
              className="w-full bg-teal-700 text-white py-3 rounded-full font-bold text-sm hover:bg-teal-800 transition-colors active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-teal-700/20"
            >
              <Wallet size={16} />
              Pagar Fatura ({formatCurrency(totalFatura)})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700 text-center">
            <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-2">
              <CreditCard size={14} className="text-teal-600 dark:text-teal-400" />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Limite Total</p>
            <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Number(card.credit_limit) || 0)}</p>
          </div>
          <div className={`rounded-[20px] p-4 shadow-sm border text-center ${
            available > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-2 ${
              available > 0 ? 'bg-emerald-100 dark:bg-emerald-800/50' : 'bg-red-100 dark:bg-red-800/50'
            }`}>
              {available > 0 ? <TrendingUp size={14} className="text-emerald-600 dark:text-emerald-400" /> : <TrendingDown size={14} className="text-red-500" />}
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Disponível</p>
            <p className={`text-[15px] font-bold ${available > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
              {formatCurrency(Math.max(0, available))}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setCurrentMonth(prev => addMonths(prev, -1))} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize">{monthLabel}</span>
          <button onClick={() => setCurrentMonth(prev => addMonths(prev, 1))} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
          <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Transações do cartão</h3>
          {transactions.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">Nenhuma transação neste período.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx, index) => {
                const isPending = tx.status === 'pending'
                return (
                  <div
                    key={tx.id}
                    onClick={() => router.push(`/transactions/${tx.id}`)}
                    className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-colors ${index !== transactions.length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isPending ? (
                        <div className="w-5 h-5 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                          <Clock size={12} className="text-orange-500" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <Check size={12} className="text-emerald-500" />
                        </div>
                      )}
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${tx.categories?.color || '#64748b'}20`, color: tx.categories?.color || '#64748b' }}>
                        <ArrowDown size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate">{tx.description || tx.categories?.name || 'Compra'}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}</p>
                      </div>
                    </div>
                    <p className="text-[14px] font-bold text-red-500 flex-shrink-0">- {formatCurrency(Number(tx.amount) || 0)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {showPayModal && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50" onClick={() => setShowPayModal(false)}>
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-3xl p-6 animate-in slide-in-from-bottom-10 duration-300" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Pagar Fatura</h3>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 p-2"><X size={20} /></button>
            </div>

            <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-500">Cartão</span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{card.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-500">Valor da fatura</span>
                <span className="text-sm font-bold text-red-500">{formatCurrency(totalFatura)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Vencimento</span>
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Dia {card.due_day}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              O valor será debitado da sua conta principal e as transações do cartão passarão a afetar seu saldo.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100 dark:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handlePayFatura}
                disabled={paying}
                className="flex-1 bg-teal-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {paying ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                {paying ? 'Pagando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}