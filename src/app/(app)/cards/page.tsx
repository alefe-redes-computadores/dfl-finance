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

const CardsSkeleton = () => (
  <div className="space-y-4 animate-pulse pt-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-gray-100 dark:border-slate-700/50">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="w-[60px] h-[40px] rounded-[10px] bg-gray-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-16 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
          </div>
          <div className="h-6 w-16 bg-gray-100 dark:bg-slate-700 rounded-full" />
        </div>
        <div className="space-y-2.5 mb-4">
          <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
          <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5" />
          <div className="flex justify-between">
            <div className="h-3 w-16 bg-gray-100 dark:bg-slate-700/50 rounded" />
            <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
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
    if (percent >= 90) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/30' }
    if (percent >= 75) return { bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/30' }
    if (percent >= 50) return { bar: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/30' }
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
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 font-sans pb-28 relative transition-colors duration-300">
      
      {/* Ponto de Luz de Sincronização */}
      {(loadingPulse) && (
        <div className="fixed top-6 right-6 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(20,184,166,0.8)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* HEADER SOFT UI */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl pt-6 pb-2 px-4 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border-b border-gray-100 dark:border-slate-800/50">
        
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push('/more')} className="p-1 -ml-1 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
                <ChevronLeft size={24} />
              </button>
              <h1 className="text-[26px] font-bold text-gray-900 dark:text-gray-100 tracking-tight">Cartões</h1>
            </div>
            <p className="text-[12px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-0.5 ml-1">
              {appMode === "personal_only" ? "Visão Pessoal" : "Visão Global"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/cards/new')}
              className="w-10 h-10 bg-teal-600 hover:bg-teal-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-600/20 transition-all active:scale-95"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <ContextToggle />
          
          {/* Seletor de Mês Super Clean */}
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-slate-800/80 px-1 py-1 rounded-full border border-gray-100 dark:border-slate-700/50">
            <button type="button" onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-200/50 dark:hover:bg-slate-700"><ChevronLeft size={16} /></button>
            <span className="text-[12px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-tight min-w-[70px] text-center">{monthLabel}</span>
            <button type="button" onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors rounded-full hover:bg-gray-200/50 dark:hover:bg-slate-700"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        
        {/* CARD CONSOLIDADO (Soma das faturas) */}
        {!loading && cardsWithInvoice.length > 0 && (
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[28px] p-6 mb-2 shadow-lg shadow-indigo-500/20 group cursor-default animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full blur-xl -ml-8 -mb-8 pointer-events-none" />
            
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-[12px] font-bold text-white/80 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Receipt size={14} /> Faturas do Mês
                </p>
                <p className="text-3xl font-black text-white tracking-tight">{formatCurrency(totalInvoices)}</p>
              </div>
            </div>
            <p className="relative z-10 text-[11px] text-indigo-50 font-medium mt-4 bg-black/10 inline-block px-3 py-1 rounded-full backdrop-blur-sm">
              Total de {cardsWithInvoice.length} {cardsWithInvoice.length === 1 ? 'cartão' : 'cartões'}
            </p>
          </div>
        )}

        {loading ? (
          <CardsSkeleton />
        ) : cardsWithInvoice.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CreditCard size={32} className="opacity-30 text-gray-500" />
            </div>
            <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-200 tracking-tight mb-1">Nenhum cartão cadastrado</h3>
            <p className="text-gray-400 dark:text-gray-500 text-[13px] font-medium mb-6 max-w-[250px]">
              Adicione cartões de crédito para acompanhar faturas e limites em um só lugar.
            </p>
            <button
              onClick={() => router.push('/cards/new')}
              className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-full font-bold text-[14px] shadow-lg shadow-teal-600/20 active:scale-95 transition-all"
            >
              Adicionar Cartão
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {cardsWithInvoice.map((card: any, index: number) => {
              const limitPercent = getLimitPercent(card.faturaAtual || 0, Number(card.limit_amount) || 0)
              const limitColor = getLimitColor(limitPercent)
              const available = (Number(card.limit_amount) || 0) - (card.faturaAtual || 0)
              const isNearLimit = limitPercent >= 90
              const brandLabel = getBrandLabel(card.brand)
              
              // Fallback de cor premium
              const cardBgColor = card.color || '#334155'

              return (
                <div
                  key={card.id}
                  onClick={() => router.push(`/cards/details?id=${card.id}`)}
                  className="bg-white dark:bg-slate-800 rounded-[28px] p-5 shadow-[0_2px_15px_rgba(0,0,0,0.02)] border border-gray-100 dark:border-slate-700/50 cursor-pointer hover:shadow-md transition-all active:scale-[0.98] animate-in fade-in slide-in-from-bottom-4 group"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      
                      {/* MOCKUP DO CARTÃO FÍSICO */}
                      <div 
                        className="w-[64px] h-[42px] rounded-[10px] shadow-sm relative overflow-hidden flex flex-col justify-between p-1.5 shrink-0 transition-transform group-hover:scale-105"
                        style={{ background: `linear-gradient(135deg, ${cardBgColor}, #00000040)` }}
                      >
                        <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 rounded-full blur-md -mr-4 -mt-4 pointer-events-none" />
                        <div className="w-3.5 h-2.5 bg-yellow-400/80 rounded-[3px] border border-yellow-500/50 opacity-80" />
                        <div className="text-[10px] font-black tracking-widest text-white/90 text-right drop-shadow-md">
                          {card.last_four ? `${card.last_four}` : '••••'}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="font-bold text-[16px] text-gray-800 dark:text-gray-100 tracking-tight truncate">{card.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {brandLabel && (
                            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{brandLabel}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isNearLimit && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-900/50">
                        <AlertTriangle size={12} className="text-red-500" />
                        <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Atenção</span>
                      </div>
                    )}
                  </div>

                  <div className="mb-5 bg-gray-50/50 dark:bg-slate-700/20 rounded-[20px] p-4 border border-gray-50 dark:border-slate-700/50">
                    <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
                      Fatura Atual
                    </p>
                    <div className="flex items-end justify-between mb-3">
                      <p className="text-[22px] font-black text-gray-800 dark:text-gray-100 leading-none tracking-tight">
                        {formatCurrency(card.faturaAtual || 0)}
                      </p>
                      <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mb-0.5">
                        Limite: {formatCurrency(Number(card.limit_amount) || 0)}
                      </span>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${limitColor.bar}`}
                        style={{ width: `${limitPercent}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between items-center mt-2">
                      <span className={`text-[11px] font-bold ${limitColor.text}`}>
                        {limitPercent.toFixed(0)}% utilizado
                      </span>
                      {available > 0 ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(available)} disponivel
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-red-500">
                          Sem limite
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Pílulas de Data Soft UI */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                      <CalendarDays size={14} className="opacity-50" />
                      <span className="text-[11px] font-bold">Fecha: dia {card.closing_day}</span>
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                      <AlertTriangle size={14} className="opacity-50" />
                      <span className="text-[11px] font-bold">Vence: dia {card.due_day}</span>
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
