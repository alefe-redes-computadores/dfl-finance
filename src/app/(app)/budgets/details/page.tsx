'use client'

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, ChevronRight, Edit2, Loader2, Check, Clock,
  AlertTriangle, CheckCircle, RefreshCw, Image, Paperclip
} from 'lucide-react'
import { format, subMonths, addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useLocalData } from '@/hooks/useLocalData'
import { useContext_ } from '@/components/ContextToggle'
import { getDynamicIcon } from '@/lib/iconUtils'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import Skeleton from '@/components/Skeleton'

const BudgetDetailSkeleton = () => (
  <div className="animate-pulse px-4 pt-6">
    <div className="flex items-center justify-between mb-6">
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
      <div className="h-5 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
      <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full" />
    </div>

    <div className="flex items-center justify-center mb-4">
      <div className="h-10 w-48 bg-gray-200 dark:bg-slate-700 rounded-full" />
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 mb-4">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-[18px] bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-5 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-[16px] p-3 bg-gray-100 dark:bg-slate-700">
            <div className="h-3 w-12 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
          </div>
        ))}
      </div>

      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
      </div>
    </div>
  </div>
)

function BudgetDetailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') as string
  const { user } = useAuth()
  const { context } = useContext_()
  const { vibrate } = useHapticFeedback()

  const [budget, setBudget] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [spent, setSpent] = useState(0)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [projection, setProjection] = useState('')

  const { data: localBudgets, loading: budgetsLoading, reload: reloadBudgets } = useLocalData({
    table: 'budgets' as any,
    filters: { id: id as string },
  })

  const { data: localTransactions, loading: txLoading, reload: reloadTransactions } = useLocalData({
    table: 'transactions' as any,
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
      await Promise.all([reloadBudgets(), reloadTransactions()])

      const budgetData = (localBudgets || [])[0] as any
      if (!budgetData) {
        router.push('/budgets')
        return
      }
      setBudget(budgetData)

      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
      const today = format(new Date(), 'yyyy-MM-dd')
      const daysPassed = differenceInDays(new Date(), startOfMonth(currentDate)) + 1

      let filteredTxs = (localTransactions || [])
        .filter((tx: any) => tx.date >= start && tx.date <= end && tx.status === 'done')

      if (budgetData.category_id) {
        filteredTxs = filteredTxs.filter((tx: any) => tx.category_id === budgetData.category_id)
      }

      const totalSpent = filteredTxs
        .filter((tx: any) => tx.type === 'expense' || tx.type === 'sangria')
        .reduce((sum: number, tx: any) => sum + (Number(tx.amount) || 0), 0)

      setTransactions(filteredTxs)
      setSpent(totalSpent)

      const remaining = Number(budgetData.amount) - totalSpent
      const dailyAverage = daysPassed > 0 ? totalSpent / daysPassed : 0

      if (dailyAverage > 0 && remaining > 0) {
        const projectedDays = Math.floor(remaining / dailyAverage)
        setDaysLeft(projectedDays)
        if (projectedDays <= 3) {
          setProjection(`⚠️ Neste ritmo, o orçamento acabará em ${projectedDays} dia(s)!`)
        } else if (projectedDays <= 7) {
          setProjection(`⚠️ Neste ritmo, dura mais ${projectedDays} dias.`)
        } else {
          setProjection(`✅ Ritmo tranquilo! Dura mais ${projectedDays} dias.`)
        }
      } else if (remaining <= 0) {
        setDaysLeft(0)
        setProjection('🔴 Orçamento estourado!')
      } else {
        setProjection('✅ Nenhum gasto registrado ainda.')
      }
    } catch (err) {
      console.error('Erro ao carregar orçamento:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [id, user, currentDate, localBudgets, localTransactions, router])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  
  const getAttachmentIcon = (url: string | null) => {
    if (!url) return null
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
    if (isImage) return <Image size={12} className="text-blue-500 shrink-0" />
    return <Paperclip size={12} className="text-gray-500 shrink-0" />
  }

  const IconComp = getDynamicIcon(budget?.icon || 'tag')

  if (loading) return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-20 font-sans transition-colors duration-300">
      <div className="flex items-center justify-between px-4 pt-6 mb-6">
        <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
      </div>
      <BudgetDetailSkeleton />
    </div>
  )

  if (!budget) return null

  const remaining = Number(budget.amount) - spent
  const percent = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0
  const isOverBudget = remaining < 0
  const isWarning = percent >= 75 && percent < 100
  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 font-sans px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.1)] rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6 sticky top-0 z-10 bg-gray-50/90 dark:bg-slate-900/90 backdrop-blur-xl py-2">
        <button onClick={() => { vibrate([5]); router.push('/budgets'); }} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors active:scale-95">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{budget.name}</h2>
        <button onClick={() => { vibrate([5]); router.push(`/budgets/new?edit=${budget.id}`); }} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 active:scale-95 rounded-full hover:bg-teal-50 dark:hover:bg-teal-900/30">
          <Edit2 size={20} />
        </button>
      </div>

      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700/50 px-2 py-1.5 rounded-full">
          <button onClick={() => { vibrate([5]); setCurrentDate(subMonths(currentDate, 1)); }} className="p-1.5 text-gray-400 bg-gray-50 dark:bg-slate-700/50 rounded-full hover:text-gray-800 transition-colors active:scale-95"><ChevronLeft size={16} /></button>
          <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-wide w-[100px] text-center">{monthLabel}</span>
          <button onClick={() => { vibrate([5]); setCurrentDate(addMonths(currentDate, 1)); }} className="p-1.5 text-gray-400 bg-gray-50 dark:bg-slate-700/50 rounded-full hover:text-gray-800 transition-colors active:scale-95"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex justify-center mb-5">
        <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm border ${
          isOverBudget 
            ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:border-red-500/20' 
            : isWarning 
              ? 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:border-orange-500/20' 
              : 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20'
        }`}>
          {isOverBudget && <AlertTriangle size={12} />}
          {!isOverBudget && !isWarning && <CheckCircle size={12} />}
          {isOverBudget ? 'Orçamento Estourado' : isWarning ? 'Atenção ao Limite' : 'Dentro do limite'}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50 dark:border-slate-700/50 mb-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-[18px] flex items-center justify-center shadow-sm" style={{ backgroundColor: `${budget.color}15`, color: budget.color }}>
            <IconComp size={24} />
          </div>
          <div>
            <p className="font-black text-[18px] text-gray-800 dark:text-gray-100 leading-tight">{budget.name}</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-1">{budget.categories?.name || 'Geral'} • {budget.period === 'monthly' ? 'Mensal' : budget.period === 'biweekly' ? 'Quinzenal' : 'Semanal'}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center bg-gray-50 dark:bg-slate-700/40 rounded-[20px] p-3.5 border border-gray-100 dark:border-slate-700/50">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest mb-1">Orçado</p>
            <p className="text-[15px] font-black text-gray-800 dark:text-gray-200">{formatCurrency(Number(budget.amount))}</p>
          </div>
          <div className="text-center bg-red-50 dark:bg-red-500/10 rounded-[20px] p-3.5 border border-red-100 dark:border-red-500/20">
            <p className="text-[10px] text-red-600/70 font-bold uppercase tracking-widest mb-1">Gasto</p>
            <p className="text-[15px] font-black text-red-500">{formatCurrency(spent)}</p>
          </div>
          <div className={`text-center rounded-[20px] p-3.5 border ${remaining >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${remaining >= 0 ? 'text-emerald-600/70' : 'text-red-600/70'}`}>Restante</p>
            <p className={`text-[15px] font-black ${remaining >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(Math.abs(remaining))}</p>
          </div>
        </div>

        <div className="w-full bg-gray-100 dark:bg-slate-700/50 rounded-full h-3 overflow-hidden mb-2 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${isOverBudget ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-teal-500'}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <p className={`text-[12px] font-bold text-right ${isOverBudget ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
          {percent.toFixed(1)}% utilizado
        </p>
      </div>

      {projection && (
        <div className={`rounded-[24px] p-4.5 mb-5 shadow-sm border flex items-start gap-3 animate-in zoom-in-95 duration-300 ${
          isOverBudget 
            ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400' 
            : isWarning || (daysLeft !== null && daysLeft <= 7) 
              ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-700 dark:text-orange-400' 
              : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
        }`}>
          <div className="mt-0.5 shrink-0">
            {isOverBudget ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          </div>
          <p className="text-[13px] font-bold leading-snug">{projection}</p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-[28px] p-6 shadow-sm border border-gray-50 dark:border-slate-700/50 animate-in fade-in duration-300">
        <h3 className="font-bold text-[16px] text-gray-800 dark:text-gray-100 mb-5">Transações deste orçamento</h3>
        {transactions.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-gray-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock size={20} className="text-gray-400" />
            </div>
            <p className="text-gray-400 dark:text-gray-500 text-[13px] font-medium">Nenhum gasto registrado neste mês.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx: any, index: number) => {
              const TxIconComp = getDynamicIcon(tx.categories?.icon || 'tag')
              const isPending = tx.status === 'pending'
              const attachmentIcon = getAttachmentIcon(tx.receipt_url)
              return (
                <div
                  key={tx.id}
                  onClick={() => { vibrate([5]); router.push(`/transactions/details?id=${tx.id}`); }}
                  className={`flex items-center justify-between p-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[20px] transition-all active:scale-[0.98] ${isPending ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 ${isPending ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-500' : 'bg-red-50 dark:bg-red-900/30 text-red-500'}`}>
                      <TxIconComp size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-bold text-gray-800 dark:text-gray-200 truncate">{tx.description || tx.categories?.name}</p>
                        {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
                      </div>
                      <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })}</p>
                    </div>
                  </div>
                  <p className="text-[15px] font-black text-red-500 flex-shrink-0">
                    - {formatCurrency(Number(tx.amount) || 0)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
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
