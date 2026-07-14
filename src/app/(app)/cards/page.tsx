'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Plus, CreditCard, RefreshCw, AlertTriangle,
  ChevronRight, CalendarDays, Receipt, X
} from 'lucide-react'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useLocalData } from '@/hooks/useLocalData'
import { format, addMonths, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Skeleton from '@/components/Skeleton'

// SKELETON
const CardsSkeleton = () => (
  <div className="space-y-4 animate-pulse pt-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] p-2 shadow-sm border border-gray-200/70 dark:border-slate-700">
        <div className="rounded-[18px] p-3">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-[58px] h-[38px] rounded-[10px] bg-gray-200 dark:bg-slate-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-16 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
            <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
          </div>
          <div className="rounded-[18px] bg-gray-100 dark:bg-slate-700/50 p-3 space-y-3">
            <div className="h-4 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-6 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-2.5 w-full bg-gray-200 dark:bg-slate-700 rounded-full" />
            <div className="flex justify-between">
              <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <div className="flex-1 h-12 bg-gray-100 dark:bg-slate-700/50 rounded-[16px]" />
            <div className="flex-1 h-12 bg-gray-100 dark:bg-slate-700/50 rounded-[16px]" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export default function CardsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { effectiveContext, appMode } = useContext_()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingPulse, setLoadingPulse] = useState(false)

  const { data: localCards, loading: cardsLoading, reload: reloadCards } = useLocalData({
    table: 'credit_cards' as any,
    filters: { context: effectiveContext, is_archived: false },
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
    filters: { context: effectiveContext },
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }, [loading])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      loadCards().finally(() => setTimeout(() => setRefreshing(false), 600))
    }
  }, [refreshing])

  const handleTouchEnd = useCallback(() => {
    isPulling.current = false
  }, [])

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

  const loadCards = async () => {
    setLoadingPulse(true)
    try {
      await Promise.all([reloadCards(), reloadTransactions()])
    } catch (err) {
      console.error('Erro ao carregar cartões:', err)
    } finally {
      setLoadingPulse(false)
    }
  }

  useEffect(() => {
    if (!user?.id) return
    if (!cardsLoading && !txLoading) {
      setLoading(false)
    }
  }, [user?.id, effectiveContext, cardsLoading, txLoading])

  const monthLabel = format(currentDate, 'MMM yyyy', { locale: ptBR })
  const startOfCurrentMonth = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const endOfCurrentMonth = format(endOfMonth(currentDate), 'yyyy-MM-dd')

  const transactionsByCard = (localTransactions || [])
    .filter((tx: any) => tx.credit_card_id && tx.date >= startOfCurrentMonth && tx.date <= endOfCurrentMonth && tx.type === 'expense')
    .reduce((acc: Record<string, number>, tx: any) => {
      const cardId = tx.credit_card_id
      acc[cardId] = (acc[cardId] || 0) + Number(tx.amount || 0)
      return acc
    }, {})

  const cardsWithInvoice = (localCards || []).map((card: any) => ({
    ...card,
    faturaAtual: transactionsByCard[card.id] || 0,
  }))

  const totalInvoices = cardsWithInvoice.reduce((sum: number, card: any) => sum + (card.faturaAtual || 0), 0)

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const getLimitPercent = (used: number, limit: number) => {
    if (!limit || limit <= 0) return 0
    return Math.min((used / limit) * 100, 100)
  }

  const getLimitColor = (percent: number) => {
    if (percent >= 90) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' }
    if (percent >= 75) return { bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' }
    if (percent >= 50) return { bar: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' }
    return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' }
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
    <div
      ref={containerRef}
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-28 relative transition-colors duration-300"
    >
      {loadingPulse && (
        <div className="fixed top-6 right-6 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* HEADER UNIFICADO */}
      <div className="sticky top-0 z-40 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => router.push('/more')}
                  className="h-9 w-9 -ml-1 rounded-[14px] flex items-center justify-center text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
                >
                  <ChevronLeft size={20} />
                </button>
                <h1 className="text-[24px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Cartões
                </h1>
              </div>
              <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5 ml-1">
                {appMode === "personal_only" ? "Visão pessoal" : "Visão global"}
              </p>
            </div>

            <button
              onClick={() => router.push('/cards/new')}
              className="h-11 w-11 rounded-[18px] bg-teal-600 hover:bg-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-[0.98] shrink-0"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <ContextToggle />
            </div>

            <div className="flex items-center gap-1.5 rounded-[18px] border border-gray-200/70 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/40 px-1.5 py-1 shrink-0">
              <button
                type="button"
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="h-9 w-9 rounded-[14px] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="min-w-[78px] text-center text-[13px] font-semibold text-gray-800 dark:text-gray-200 capitalize">
                {monthLabel}
              </span>

              <button
                type="button"
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="h-9 w-9 rounded-[14px] flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {/* CARD CONSOLIDADO */}
        {!loading && cardsWithInvoice.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-5 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 ml-1 mb-1">
                  Faturas do mês
                </p>
                <p className="text-[30px] leading-none font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {formatCurrency(totalInvoices)}
                </p>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-2">
                  Total de {cardsWithInvoice.length} {cardsWithInvoice.length === 1 ? 'cartão' : 'cartões'}
                </p>
              </div>

              <div className="w-12 h-12 rounded-[18px] bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                <Receipt size={20} className="text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <CardsSkeleton />
        ) : cardsWithInvoice.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <CreditCard size={28} className="opacity-30 text-gray-500" />
            </div>
            <h3 className="font-semibold text-[15px] text-gray-800 dark:text-gray-200 mb-1">
              Nenhum cartão cadastrado
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-[12px] mb-6 max-w-[250px]">
              Adicione cartões de crédito para acompanhar faturas e limites em um só lugar.
            </p>
            <button
              onClick={() => router.push('/cards/new')}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-[20px] font-bold text-[14px] shadow-lg shadow-teal-600/20 active:scale-[0.98] transition-all"
            >
              Adicionar Cartão
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {cardsWithInvoice.map((card: any, index: number) => {
              const limitPercent = getLimitPercent(card.faturaAtual || 0, Number(card.limit_amount) || 0)
              const limitColor = getLimitColor(limitPercent)
              const available = (Number(card.limit_amount) || 0) - (card.faturaAtual || 0)
              const isNearLimit = limitPercent >= 90
              const brandLabel = getBrandLabel(card.brand)
              const cardBgColor = card.color || '#334155'

              return (
                <div
                  key={card.id}
                  onClick={() => router.push(`/cards/details?id=${card.id}`)}
                  className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2 cursor-pointer animate-in fade-in slide-in-from-bottom-4 transition-colors active:scale-[0.98]"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="rounded-[18px] p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className="w-[58px] h-[38px] rounded-[10px] shadow-sm relative overflow-hidden flex flex-col justify-between p-1.5 shrink-0"
                          style={{ background: `linear-gradient(135deg, ${cardBgColor}, #00000035)` }}
                        >
                          <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 rounded-full blur-md -mr-4 -mt-4 pointer-events-none" />
                          <div className="w-3.5 h-2.5 bg-yellow-400/80 rounded-[3px] border border-yellow-500/50 opacity-80" />
                          <div className="text-[10px] font-black tracking-widest text-white/90 text-right drop-shadow-md">
                            {card.last_four ? `${card.last_four}` : '••••'}
                          </div>
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                            {card.name}
                          </p>

                          <div className="mt-1 flex items-center gap-1.5 min-w-0 text-[12px] text-gray-400 dark:text-gray-500">
                            {brandLabel && <span className="truncate">{brandLabel}</span>}
                            {brandLabel && <span className="text-gray-300 dark:text-slate-600">•</span>}
                            <span className="truncate">{formatCurrency(Number(card.limit_amount) || 0)} limite</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isNearLimit && (
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-semibold">
                            <AlertTriangle size={11} />
                            Atenção
                          </div>
                        )}

                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-700 flex items-center justify-center">
                          <ChevronRight size={15} className="text-gray-400 dark:text-gray-500" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[18px] bg-gray-50/80 dark:bg-slate-900/40 border border-gray-200/70 dark:border-slate-700 p-3">
                      <div className="flex items-end justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            Fatura atual
                          </p>
                          <p className="text-[20px] leading-none font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                            {formatCurrency(card.faturaAtual || 0)}
                          </p>
                        </div>

                        <span className="text-[12px] text-gray-400 dark:text-gray-500 shrink-0">
                          {limitPercent.toFixed(0)}% utilizado
                        </span>
                      </div>

                      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${limitColor.bar}`}
                          style={{ width: `${limitPercent}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center mt-2 gap-3">
                        <span className={`text-[12px] font-semibold ${limitColor.text}`}>
                          Limite: {formatCurrency(Number(card.limit_amount) || 0)}
                        </span>

                        {available > 0 ? (
                          <span className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 text-right">
                            {formatCurrency(available)} disponível
                          </span>
                        ) : (
                          <span className="text-[12px] font-semibold text-red-500 text-right">
                            Sem limite
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[16px] bg-gray-50 dark:bg-slate-900/40 border border-gray-200/70 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                        <CalendarDays size={14} className="opacity-60" />
                        <span className="text-[12px] font-semibold">Fecha dia {card.closing_day}</span>
                      </div>

                      <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-[16px] bg-gray-50 dark:bg-slate-900/40 border border-gray-200/70 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                        <AlertTriangle size={14} className="opacity-60" />
                        <span className="text-[12px] font-semibold">Vence dia {card.due_day}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}