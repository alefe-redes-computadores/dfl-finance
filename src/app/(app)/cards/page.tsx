'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, Plus, CreditCard, RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'

const CardsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    {[1, 2].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-16 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
          </div>
          <div className="h-6 w-16 bg-gray-200 dark:bg-slate-700 rounded-full" />
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden mb-3">
          <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
        </div>
        <div className="flex justify-between">
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>
    ))}
  </div>
)

export default function CardsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingPulse, setLoadingPulse] = useState(false)

  // ============================================================
  // 🔥 CORRIGIDO: Removidos orderBy e realtime
  // ============================================================
  const { data: localCards, loading: cardsLoading, reload: reloadCards } = useLocalData({
    table: 'credit_cards' as any,
    filters: { context, is_archived: false },
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context },
  })

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
      loadCards().finally(() => setRefreshing(false))
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
  const loadCards = async () => {
    setLoading(true)
    setLoadingPulse(true)

    try {
      await Promise.all([reloadCards(), reloadTransactions()])
    } catch (err) {
      console.error('Erro ao carregar cartões:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    loadCards()
  }, [user?.id, context])

  // ============================================================
  // PROCESSAMENTO EM MEMÓRIA (ELIMINANDO N+1)
  // ============================================================
  const today = new Date()
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]

  const transactionsByCard = (localTransactions || [])
    .filter((tx: any) => tx.credit_card_id && tx.date >= startOfMonth && tx.date <= endOfMonth)
    .reduce((acc: Record<string, number>, tx: any) => {
      const cardId = tx.credit_card_id
      acc[cardId] = (acc[cardId] || 0) + Number(tx.amount || 0)
      return acc
    }, {})

  const cardsWithInvoice = (localCards || []).map((card: any) => ({
    ...card,
    faturaAtual: transactionsByCard[card.id] || 0,
  }))

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

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-24 relative transition-colors duration-300">
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

      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            Cartões {cardsWithInvoice.length > 0 && `(${cardsWithInvoice.length})`}
          </h1>
          <button onClick={() => router.push('/cards/new')} className="p-2 -mr-2 text-teal-700 dark:text-teal-400">
            <Plus size={24} />
          </button>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {loading ? (
          <CardsSkeleton />
        ) : cardsWithInvoice.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <CreditCard size={40} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Nenhum cartão</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 max-w-[250px]">
              Adicione cartões de crédito para acompanhar suas faturas e limite.
            </p>
            <button
              onClick={() => router.push('/cards/new')}
              className="bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-sm"
            >
              Adicionar cartão
            </button>
          </div>
        ) : (
          cardsWithInvoice.map((card: any, index: number) => {
            const limitPercent = getLimitPercent(card.faturaAtual || 0, Number(card.limit_amount) || 0)
            const limitColor = getLimitColor(limitPercent)
            const available = (Number(card.limit_amount) || 0) - (card.faturaAtual || 0)
            const isNearLimit = limitPercent >= 90
            const brandLabel = getBrandLabel(card.brand)

            return (
              <div
                key={card.id}
                onClick={() => router.push(`/cards/${card.id}`)}
                className={`relative overflow-hidden bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border cursor-pointer hover:shadow-md transition-all active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 ${
                  isNearLimit ? 'border-red-200 dark:border-red-800' : 'border-gray-100 dark:border-slate-700'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-[24px] ${
                  isNearLimit ? 'bg-red-500' : limitPercent >= 70 ? 'bg-amber-500' : 'bg-teal-500'
                }`} />

                <div className="flex items-center justify-between mb-4 mt-1">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
                      style={{ backgroundColor: card.color || '#f97316' }}
                    >
                      <CreditCard size={22} />
                    </div>
                    <div>
                      <p className="font-bold text-[15px] text-gray-800 dark:text-gray-200">{card.name}</p>
                      <div className="flex items-center gap-2">
                        {brandLabel && (
                          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">{brandLabel}</span>
                        )}
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {card.last_four ? `•••• ${card.last_four}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isNearLimit && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/30">
                      <AlertTriangle size={12} className="text-red-500" />
                      <span className="text-[10px] font-bold text-red-600 dark:text-red-400">Limite próximo</span>
                    </div>
                  )}
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-[11px] mb-1.5">
                    <span className="font-medium text-gray-500 dark:text-gray-400">
                      Fatura atual: <span className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(card.faturaAtual || 0)}</span>
                    </span>
                    <span className="font-medium text-gray-400 dark:text-gray-500">
                      Limite: {formatCurrency(Number(card.limit_amount) || 0)}
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

                <div className="flex items-center gap-4 text-[11px] text-gray-400 dark:text-gray-500">
                  <span>Fecha dia {card.closing_day}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <span>Vence dia {card.due_day}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}