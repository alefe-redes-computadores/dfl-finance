'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, ChevronRight, Edit2, Loader2, Check, Clock, Trash2,
  Home, Utensils, Car, HeartPulse, GraduationCap, Gamepad2, Shirt,
  Smile, Repeat, Wrench, Dog, FileText, Shield, Gift, MoreHorizontal,
  Briefcase, Laptop, TrendingUp, ShoppingCart, ReceiptIcon, Zap, Music,
  ArrowLeftRight, TrendingUp as TrendingUpIcon, RefreshCw, Image, Paperclip, AlertTriangle, CheckCircle
} from 'lucide-react'
import { format, subMonths, addMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ICON_MAP: Record<string, React.ElementType> = {
  home: Home, utensils: Utensils, car: Car, heart: HeartPulse,
  graduation: GraduationCap, gamepad: Gamepad2, shirt: Shirt,
  smile: Smile, repeat: Repeat, wrench: Wrench, dog: Dog,
  file: FileText, shield: Shield, gift: Gift, briefcase: Briefcase,
  laptop: Laptop, trending: TrendingUpIcon, shopping: ShoppingCart,
  receipt: ReceiptIcon, zap: Zap, music: Music, other: MoreHorizontal
}

// ============================================================
// SKELETON LOADER
// ============================================================
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

    <div className="flex justify-center mb-4">
      <div className="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded-full" />
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-slate-700" />
        <div className="space-y-2">
          <div className="h-4 w-28 bg-gray-200 dark:bg-slate-700 rounded" />
          <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl p-3 bg-gray-100 dark:bg-slate-700">
            <div className="h-3 w-12 bg-gray-200 dark:bg-slate-600 rounded mx-auto mb-2" />
            <div className="h-5 w-16 bg-gray-200 dark:bg-slate-600 rounded mx-auto" />
          </div>
        ))}
      </div>

      <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
        <div className="h-full bg-gray-200 dark:bg-slate-600 rounded-full w-2/3" />
      </div>
      <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded ml-auto" />
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700">
      <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-50 dark:border-slate-700 last:border-b-0">
          <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-2.5 w-1/2 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
          <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
        </div>
      ))}
    </div>
  </div>
)

export default function BudgetDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuth()

  const [budget, setBudget] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [spent, setSpent] = useState(0)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [daysLeft, setDaysLeft] = useState<number | null>(null)
  const [projection, setProjection] = useState('')

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

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

  const getAttachmentIcon = (url: string | null) => {
    if (!url) return null
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
    if (isImage) return <Image size={12} className="text-blue-500 shrink-0" />
    return <Paperclip size={12} className="text-gray-500 shrink-0" />
  }

  const loadData = useCallback(async () => {
    if (!id || !user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const today = format(new Date(), 'yyyy-MM-dd')
    const daysInMonth = differenceInDays(endOfMonth(currentDate), startOfMonth(currentDate)) + 1
    const daysPassed = differenceInDays(new Date(), startOfMonth(currentDate)) + 1

    const { data: budgetData } = await supabase
      .from('budgets')
      .select('*, categories(name, icon, color)')
      .match({ id: id, user_id: user.id })
      .single()

    if (budgetData) {
      setBudget(budgetData)

      let query = supabase
        .from('transactions')
        .select('*, categories(name, icon, color), accounts!account_id(name)')
        .match({ user_id: user.id, context: budgetData.context })
        .gte('date', start)
        .lte('date', end)
        .eq('status', 'done')

      if (budgetData.category_id) {
        query = query.eq('category_id', budgetData.category_id)
      }

      const { data: txsData } = await query.order('date', { ascending: false })

      const txs = Array.isArray(txsData) ? txsData : []
      const totalSpent = txs
        .filter(t => t.type === 'expense' || t.type === 'sangria')
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)

      setTransactions(txs)
      setSpent(totalSpent)

      const remaining = Number(budgetData.amount) - totalSpent
      const dailyAverage = daysPassed > 0 ? totalSpent / daysPassed : 0
      
      if (dailyAverage > 0 && remaining > 0) {
        const projectedDays = Math.floor(remaining / dailyAverage)
        setDaysLeft(projectedDays)
        if (projectedDays <= 3) {
          setProjection(`⚠️ Neste ritmo, o orçamento acabará em ${projectedDays} dia(s)!`)
        } else if (projectedDays <= 7) {
          setProjection(`⚠️ Neste ritmo, o orçamento dura mais ${projectedDays} dias.`)
        } else {
          setProjection(`✅ Ritmo tranquilo! O orçamento dura mais ${projectedDays} dias.`)
        }
      } else if (remaining <= 0) {
        setDaysLeft(0)
        setProjection('🔴 Orçamento estourado!')
      } else {
        setProjection('✅ Nenhum gasto registrado ainda.')
      }
    }

    setLoading(false)
    setLoadingPulse(false)
  }, [id, user, currentDate])

  useEffect(() => { loadData() }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading) return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}
      <BudgetDetailSkeleton />
    </div>
  )

  if (!budget) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
      <p className="text-gray-500 dark:text-gray-400">Orçamento não encontrado.</p>
    </div>
  )

  const IconComp = ICON_MAP[budget.icon] || ICON_MAP['other']
  const remaining = Number(budget.amount) - spent
  const percent = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0
  const isOverBudget = remaining < 0
  const isWarning = percent >= 75 && percent < 100
  const isSafe = !isOverBudget && !isWarning

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-20 font-sans px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
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

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => router.push('/budgets')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[18px] font-bold text-gray-800 dark:text-gray-100">{budget.name}</h2>
        <button onClick={() => router.push(`/budgets/new?edit=${budget.id}`)} className="p-2 -mr-2 text-teal-700 dark:text-teal-400 hover:text-teal-800 transition-colors">
          <Edit2 size={20} />
        </button>
      </div>

      <div className="flex items-center justify-center mb-4">
        <div className="flex items-center gap-3 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 px-3 py-1.5 rounded-full">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={18} /></button>
          <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-wide">{monthLabel}</span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="flex justify-center mb-4">
        <span className={`text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
          isOverBudget 
            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
            : isWarning 
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        }`}>
          {isOverBudget && <AlertTriangle size={10} />}
          {isSafe && <CheckCircle size={10} />}
          {isOverBudget ? 'Estourado' : isWarning ? 'Atenção' : 'Dentro do limite'}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 mb-4 animate-in fade-in duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${budget.color}20`, color: budget.color }}>
            <IconComp size={24} />
          </div>
          <div>
            <p className="font-bold text-[16px] text-gray-800 dark:text-gray-100">{budget.name}</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">{budget.categories?.name || 'Todas as categorias'} • {budget.period === 'monthly' ? 'Mensal' : budget.period === 'biweekly' ? 'Quinzenal' : 'Semanal'}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-gray-50 dark:bg-slate-700 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Orçado</p>
            <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{formatCurrency(Number(budget.amount))}</p>
          </div>
          <div className="text-center bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Gasto</p>
            <p className="text-[15px] font-bold text-red-500">{formatCurrency(spent)}</p>
          </div>
          <div className={`text-center rounded-xl p-3 ${remaining >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase mb-1">Restante</p>
            <p className={`text-[15px] font-bold ${remaining >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(Math.abs(remaining))}</p>
          </div>
        </div>

        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden mb-2">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-out ${isOverBudget ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-teal-500'}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <p className={`text-[11px] font-medium text-right ${isOverBudget ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
          {percent.toFixed(1)}% utilizado
          {isOverBudget && ' • Estourado!'}
        </p>
      </div>

      {projection && (
        <div className={`rounded-[20px] p-4 mb-4 shadow-sm border flex items-start gap-3 ${
          isOverBudget 
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400' 
            : isWarning || (daysLeft !== null && daysLeft <= 7) 
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400' 
              : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
        }`}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p className="text-[13px] font-bold">{projection}</p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 animate-in fade-in duration-300">
        <h3 className="font-bold text-[15px] text-gray-800 dark:text-gray-100 mb-4">Transações do mês</h3>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3 animate-pulse">
                <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-slate-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
                  <div className="h-2.5 w-1/2 bg-gray-100 dark:bg-slate-700/50 rounded" />
                </div>
                <div className="h-4 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 text-sm py-6">Nenhuma transação neste mês.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx, index) => {
              const TxIconComp = ICON_MAP[tx.categories?.icon] || ICON_MAP['other']
              const isIncomeVisual = tx.type === 'income'
              const isPending = tx.status === 'pending'
              const attachmentIcon = getAttachmentIcon(tx.receipt_url)
              return (
                <div
                  key={tx.id}
                  onClick={() => router.push(`/transactions/${tx.id}`)}
                  className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition-colors active:scale-[0.98] ${isPending ? 'bg-amber-50 dark:bg-amber-900/10' : ''} ${index !== transactions.length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isPending ? (
                      <div className="w-5 h-5 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <Clock size={12} className="text-red-400" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                        <Check size={12} className="text-emerald-500" />
                      </div>
                    )}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tx.categories?.color || '#64748b'}20`, color: tx.categories?.color || '#64748b' }}>
                      <TxIconComp size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200 truncate">{tx.description || tx.categories?.name}</p>
                        {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
                      </div>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })} • {tx.accounts?.name || 'Geral'}</p>
                    </div>
                  </div>
                  <p className={`text-[14px] font-bold flex-shrink-0 ${isIncomeVisual ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isIncomeVisual ? '+' : '-'} {formatCurrency(Number(tx.amount) || 0)}
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