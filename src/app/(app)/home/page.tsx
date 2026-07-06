'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef, lazy, Suspense, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  Eye, EyeOff, ChevronRight, ChevronLeft, ArrowDown, ArrowUp,
  Plus, Clock, Check, CreditCard, Wallet, Settings2,
  AlertTriangle, Image, Paperclip, TrendingUp, TrendingDown,
  Sun, Moon, Sunrise, Sunset, RefreshCw, ArrowRightLeft, Building2, User,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import NetworkStatus from '@/components/NetworkStatus'
import InvoiceAlert from '@/components/InvoiceAlert'
import DebtAlert from '@/components/DebtAlert'
import NotificationBell from '@/components/NotificationBell'
import NotificationCenter from '@/components/NotificationCenter'
import SyncButton from '@/components/SyncButton'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import FAB from '@/components/FAB'
import PersonalizeModal from '@/components/PersonalizeModal'
import Skeleton from '@/components/Skeleton'
import { UndoToast } from '@/components/ui/UndoToast'
import { useLocalData } from '@/hooks/useLocalData'

const ProjectionSparklineCard = lazy(() => import('@/components/ProjectionSparklineCard'))

const ALL_SECTIONS = [
  { id: 'balance', label: 'Saldo Total' },
  { id: 'income-expense', label: 'Receitas / Despesas' },
  { id: 'projection', label: 'Projeção de Saldo' },
  { id: 'loans', label: 'Empréstimos entre Contextos' },
  { id: 'next-card', label: 'Próxima Fatura' },
  { id: 'pendings', label: 'Pendências' },
  { id: 'receivables', label: 'A Receber' },
  { id: 'financings', label: 'Financiamentos' },
  { id: 'budgets', label: 'Orçamentos' },
  { id: 'accounts', label: 'Contas' },
  { id: 'cards', label: 'Cartões' },
  { id: 'recent', label: 'Transações Recentes' },
]

const DEFAULT_SECTION_ORDER = ALL_SECTIONS.map(s => s.id)
const FIXED_SECTIONS = ['balance', 'income-expense', 'pendings', 'accounts', 'cards', 'recent']

const getContextLabel = (ctx: string) => ctx === 'dfl' ? 'PJ' : 'PF'
const getContextIcon = (ctx: string) => ctx === 'dfl' ? <Building2 size={14} className="text-blue-500" /> : <User size={14} className="text-emerald-500" />

function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return { text: 'Bom dia', icon: <Sunrise size={18} className="text-amber-500 shrink-0" /> }
  if (hour >= 12 && hour < 18) return { text: 'Boa tarde', icon: <Sun size={18} className="text-amber-500 shrink-0" /> }
  if (hour >= 18 && hour < 22) return { text: 'Boa noite', icon: <Sunset size={18} className="text-indigo-400 shrink-0" /> }
  return { text: 'Boa noite', icon: <Moon size={18} className="text-indigo-400 shrink-0" /> }
}

function HomeContent() {
  const { user } = useAuth()
  const router = useRouter()
  const { context, appMode } = useContext_()
  const { showToast } = useToast()
  
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const [enabledSections, setEnabledSections] = useState<string[]>(DEFAULT_SECTION_ORDER)
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false)
  const [personalizeOrder, setPersonalizeOrder] = useState<typeof ALL_SECTIONS>(ALL_SECTIONS)
  const [personalizeEnabled, setPersonalizeEnabled] = useState<Set<string>>(new Set(DEFAULT_SECTION_ORDER))

  const [undoToast, setUndoToast] = useState<{ message: string; onUndo: () => void } | null>(null)

  const { isOnline, pendingCount, isSyncing, syncQueue } = useOfflineQueue()

  const monthLabel = format(currentDate, 'MMMM', { locale: ptBR })
  const greeting = getGreeting()
  const firstName = (user?.user_metadata?.name || 'Álefe').split(' ')[0]

  // ============================================================
  // 🔥 DADOS LOCAIS (Reativos - Dexie)
  // ============================================================
  const { data: localTransactions, loading: txLoading, reload: reloadTxs } = useLocalData({ 
    table: 'transactions' as any, 
    filters: { context },
    orderBy: 'date',
    orderDir: 'desc',
  })
  const { data: localCategories, loading: catLoading } = useLocalData({ 
    table: 'categories' as any, 
    filters: { context }
  })
  const { data: localAccountsData, loading: accLoading } = useLocalData({ 
    table: 'accounts' as any, 
    filters: { context }
  })
  const { data: localDebts, loading: debtsLoading } = useLocalData({ 
    table: 'debts' as any, 
    filters: { context }
  })
  const { data: localFinancings, loading: finLoading } = useLocalData({ 
    table: 'financings' as any, 
    filters: { context, status: 'active' }
  })
  const { data: localCards, loading: cardsLoading } = useLocalData({ 
    table: 'credit_cards' as any, 
    filters: { context, is_archived: false }
  })
  const { data: localBudgets, loading: budgetsLoading } = useLocalData({
    table: 'budgets' as any,
    filters: { context }
  })
  const { data: localLoans, loading: loansLoading } = useLocalData({
    table: 'loans' as any,
    filters: { context }
  })
  const { data: localNotifications, loading: notifsLoading, reload: reloadNotifs } = useLocalData({
    table: 'notifications' as any,
    filters: { user_id: user?.id }
  })

  const isDataLoading = txLoading || catLoading || accLoading || debtsLoading || finLoading || cardsLoading || budgetsLoading || loansLoading || notifsLoading

  useEffect(() => {
    setLoadingPulse(isDataLoading)
  }, [isDataLoading])

  useEffect(() => {
    if (!isDataLoading && (localTransactions?.length || localAccountsData?.length)) {
      setIsInitialLoad(false)
    }
  }, [isDataLoading, localTransactions, localAccountsData])

  // ============================================================
  // 🔥 CÁLCULOS EM TEMPO REAL (useMemo elimina o flicker)
  // ============================================================
  
  const start = useMemo(() => format(startOfMonth(currentDate), 'yyyy-MM-dd'), [currentDate])
  const end = useMemo(() => format(endOfMonth(currentDate), 'yyyy-MM-dd'), [currentDate])

  const transactionsWithJoin = useMemo(() => {
    return (localTransactions || []).map((tx: any) => {
      const category = (localCategories || []).find((c: any) => c.id === tx.category_id) as any
      const account = (localAccountsData || []).find((a: any) => a.id === tx.account_id) as any
      return {
        ...tx,
        categories: category ? { name: category.name, icon: category.icon, color: category.color } : null,
        accounts: account ? { name: account.name, color: account.color } : null,
      }
    })
  }, [localTransactions, localCategories, localAccountsData])

  const monthTransactions = useMemo(() => 
    transactionsWithJoin.filter((t: any) => t.date >= start && t.date <= end),
  [transactionsWithJoin, start, end])

  const summary = useMemo(() => {
    const income = monthTransactions
      .filter((t: any) => t.type === 'income' && t.status === 'done')
      .reduce((a: number, t: any) => a + (parseFloat(t.amount) || 0), 0)
    const expense = monthTransactions
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
      .reduce((a: number, t: any) => a + (parseFloat(t.amount) || 0), 0)
    return { income, expense, balance: income - expense }
  }, [monthTransactions])

  const { previousBalance, balanceVariation } = useMemo(() => {
    const prevMonthDate = subMonths(currentDate, 1)
    const prevStart = format(startOfMonth(prevMonthDate), 'yyyy-MM-dd')
    const prevEnd = format(endOfMonth(prevMonthDate), 'yyyy-MM-dd')
    const prevMonthTxs = transactionsWithJoin.filter((t: any) => t.date >= prevStart && t.date <= prevEnd)
    
    const prevInc = prevMonthTxs.filter((t: any) => t.type === 'income' && t.status === 'done').reduce((a, t) => a + (parseFloat(t.amount) || 0), 0)
    const prevExp = prevMonthTxs.filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + (parseFloat(t.amount) || 0), 0)
    const prevBal = prevInc - prevExp
    
    const variation = prevBal !== 0 ? ((summary.balance - prevBal) / Math.abs(prevBal)) * 100 : (summary.balance > 0 ? 100 : summary.balance < 0 ? -100 : 0)
    return { previousBalance: prevBal, balanceVariation: variation }
  }, [transactionsWithJoin, currentDate, summary.balance])

  const recentTransactions = useMemo(() => monthTransactions.slice(0, 5), [monthTransactions])

  const accounts = useMemo(() => {
    return (localAccountsData || []).map((acc: any) => {
      const accTxs = monthTransactions.filter((t: any) => t.account_id === acc.id && t.status === 'pending')
      const pendingIncome = accTxs.filter((t: any) => t.type === 'income').reduce((a: number, t: any) => a + (parseFloat(t.amount) || 0), 0)
      const pendingExpense = accTxs.filter((t: any) => t.type === 'expense' || t.type === 'sangria').reduce((a: number, t: any) => a + (parseFloat(t.amount) || 0), 0)
      const previsto = (Number(acc.balance) || 0) + pendingIncome - pendingExpense
      return { ...acc, previsto }
    })
  }, [localAccountsData, monthTransactions])

  const cards = useMemo(() => {
    return (localCards || []).map((card: any) => {
      const cardTxs = monthTransactions.filter((t: any) => t.credit_card_id === card.id)
      const faturaAtual = cardTxs.reduce((acc: number, t: any) => acc + (parseFloat(t.amount) || 0), 0)
      return { ...card, faturaAtual }
    })
  }, [localCards, monthTransactions])

  const pendings = useMemo(() => {
    const toPay = monthTransactions
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'pending' && !t.credit_card_id)
      .reduce((a: number, t: any) => a + (parseFloat(t.amount) || 0), 0)
    const toReceive = monthTransactions
      .filter((t: any) => t.type === 'income' && t.status === 'pending')
      .reduce((a: number, t: any) => a + (parseFloat(t.amount) || 0), 0)
    const faturas = cards.reduce((acc: number, c: any) => acc + c.faturaAtual, 0)
    return { toPay, toReceive, faturas }
  }, [monthTransactions, cards])

  const debtsList = useMemo(() => {
    const allDebts = (localDebts || []).map((debt: any) => {
      const payments = (localTransactions || []).filter((t: any) => t.debt_id === debt.id && t.type === 'income')
      const paidAmount = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0)
      const totalAmount = Number(debt.total_amount) || 0
      const isEffectivelyPaid = totalAmount > 0 && paidAmount >= totalAmount
      const percent = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0
      
      return { 
        ...debt, 
        paid_amount: paidAmount, 
        percent: Math.min(percent, 100),
        status: isEffectivelyPaid ? 'paid' : debt.status
      }
    })
    return allDebts.filter(d => d.status !== 'paid' && d.status !== 'cancelled')
  }, [localDebts, localTransactions])

  const financings = localFinancings || []

  const budgets = useMemo(() => {
    const budgetsWithSpent = (localBudgets || []).map((budget: any) => {
      const cat = (localCategories || []).find((c: any) => c.id === budget.category_id) as any
      const spent = monthTransactions
        .filter((t: any) => t.category_id === budget.category_id && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
        .reduce((a: number, t: any) => a + (parseFloat(t.amount) || 0), 0)
      const remaining = Number(budget.amount) - spent
      const percent = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0
      return { 
        ...budget, 
        name: cat?.name ?? budget.name,
        icon: cat?.icon ?? budget.icon,
        color: cat?.color ?? budget.color,
        spent, 
        remaining, 
        percent: Math.min(percent, 100) 
      }
    })
    return budgetsWithSpent.sort((a: any, b: any) => b.percent - a.percent).slice(0, 3)
  }, [localBudgets, localCategories, monthTransactions])

  const loans = useMemo(() => {
    return (localLoans || [])
      .filter((l: any) => l.status === 'active' || l.status === 'completed')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [localLoans])

  // ============================================================
  // 🔥 NOTIFICAÇÕES — MAPEAMENTO CORRETO COM is_read
  // ============================================================
  const notificationsMap = useMemo(() => {
    return (localNotifications || [])
      .map((n: any) => ({ 
        ...n, 
        isRead: n.is_read === true || n.isRead === true || n.read === true,
        cardId: n.card_id || n.cardId 
      }))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [localNotifications])

  const unreadNotifications = useMemo(() => 
    notificationsMap.filter((n: any) => !n.isRead).length, 
  [notificationsMap])
  
  const criticalCount = useMemo(() => 
    notificationsMap.filter((n: any) => n.severity === 'critical' && !n.isRead).length, 
  [notificationsMap])

  // ============================================================
  // 🔥 GERAÇÃO AUTOMÁTICA DE NOTIFICAÇÕES LOCAIS (Dexie)
  // ============================================================
  useEffect(() => {
    if (!user?.id || cards.length === 0) return
    const generateNotifs = async () => {
      const todayDay = new Date().getDate()
      let addedNew = false

      for (const card of cards) {
        const days = (card.due_day || 1) - todayDay
        let notifData = null

        if (days < 0 && card.faturaAtual > 0) {
          notifData = {
            id: `invoice-overdue-${card.id}-${currentDate.getMonth()}`,
            user_id: user.id,
            type: 'invoice_overdue',
            title: `Fatura vencida: ${card.name}`,
            subtitle: `Venceu dia ${card.due_day}`,
            card_id: card.id,
            severity: 'critical',
            is_read: false,
            created_at: new Date().toISOString()
          }
        } else if (days <= 3 && days >= 0 && card.faturaAtual > 0) {
          notifData = {
            id: `invoice-soon-${card.id}-${currentDate.getMonth()}`,
            user_id: user.id,
            type: 'invoice_soon',
            title: `Fatura próxima: ${card.name}`,
            subtitle: `Vence em ${days} dia(s)`,
            card_id: card.id,
            severity: 'warning',
            is_read: false,
            created_at: new Date().toISOString()
          }
        }

        if (notifData) {
          const existing = await db.table('notifications').get(notifData.id)
          if (!existing) {
            await db.table('notifications').put({ ...notifData, sync_status: 'pending', sync_attempts: 0 })
            addedNew = true
          }
        }
      }
      if (addedNew) reloadNotifs()
    }
    generateNotifs()
  }, [cards, user?.id, currentDate, reloadNotifs])

  // ============================================================
  // BUSCA REMOTA PARA LAYOUT
  // ============================================================
  useEffect(() => {
    if (user?.id && isOnline) {
      supabase.from('home_layout').select('section_order').match({ user_id: user.id, context }).single().then(({ data }) => {
        if (data?.section_order) {
          setEnabledSections(data.section_order)
          setPersonalizeOrder(ALL_SECTIONS.filter(s => data.section_order.includes(s.id)))
          setPersonalizeEnabled(new Set(data.section_order))
        }
      })
    }
  }, [user?.id, context, isOnline])

  const saveLayout = async (order: string[]) => {
    if (!user?.id) return
    setEnabledSections(order)
    await supabase.from('home_layout').upsert({ user_id: user.id, context, section_order: order }, { onConflict: 'user_id,context' })
  }

  // ============================================================
  // NAVEGAÇÃO INTELIGENTE
  // ============================================================
  const goBack = useCallback(() => {
    if (window.history.length > 2) {
      router.back()
    } else {
      router.push('/home')
    }
  }, [router])

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || isDataLoading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = async (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      await Promise.all([reloadTxs(), reloadNotifs()])
      setRefreshing(false)
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
  }, [isDataLoading, refreshing])

  const toggleSection = (id: string) => { setPersonalizeEnabled(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const moveSection = (id: string, direction: 'up' | 'down') => { setPersonalizeOrder((prev) => { const currentIndex = prev.findIndex((item) => item.id === id); if (currentIndex === -1) return prev; const newOrder = [...prev]; const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1; if (targetIndex >= 0 && targetIndex < newOrder.length) { [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]] } return newOrder }) }
  const handleSavePersonalize = () => { const finalOrder = personalizeOrder.filter(s => personalizeEnabled.has(s.id)).map(s => s.id); saveLayout(finalOrder); setShowPersonalizeModal(false); showToast('Tela inicial personalizada!', 'success') }
  const openPersonalize = () => { const enabledOrder = enabledSections.map(id => ALL_SECTIONS.find(s => s.id === id)).filter(Boolean) as typeof ALL_SECTIONS; const missing = ALL_SECTIONS.filter(s => !enabledSections.includes(s.id)); setPersonalizeOrder([...enabledOrder, ...missing]); setPersonalizeEnabled(new Set(enabledSections)); setShowPersonalizeModal(true) }

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const totalAccountsBalance = accounts.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0)
  
  const today = new Date()
  const todayDay = today.getDate()
  const sortedByDue = [...cards].sort((a, b) => { const aDue = a.due_day < todayDay ? a.due_day + 31 : a.due_day; const bDue = b.due_day < todayDay ? b.due_day + 31 : b.due_day; return aDue - bDue })
  const nextCard = sortedByDue.length > 0 ? sortedByDue[0] : null
  const allCardsPaid = cards.length > 0 && cards.every((c) => (c.faturaAtual || 0) === 0)

  const getAttachmentIcon = (url: string | null) => { if (!url) return null; const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url); if (isImage) return <Image size={12} className="text-blue-500 shrink-0" />; return <Paperclip size={12} className="text-gray-500 shrink-0" /> }

  const handleHideCard = (sectionId: string, sectionLabel: string) => {
    const removedSection = sectionId
    const removedLabel = sectionLabel
    setEnabledSections(prev => prev.filter(id => id !== removedSection))
    setUndoToast({ message: `"${removedLabel}" ocultado`, onUndo: () => { setEnabledSections(prev => { const restored = [...prev, removedSection]; return restored.sort((a, b) => { const idxA = ALL_SECTIONS.findIndex(s => s.id === a); const idxB = ALL_SECTIONS.findIndex(s => s.id === b); return idxA - idxB }) }); showToast(`"${removedLabel}" restaurado`, 'success'); setUndoToast(null) } })
    setTimeout(() => { setEnabledSections(current => { if (!current.includes(removedSection)) saveLayout(current); return current }); setUndoToast(null) }, 3500)
  }

  const getBalanceStyle = (val: number) => { if (val > 0) return 'text-emerald-600 font-bold'; if (val < 0) return 'text-red-500 font-bold'; return 'text-gray-800 dark:text-gray-200 font-bold' }

  useEffect(() => { const saved = localStorage.getItem('dfl_notifications_enabled'); setNotificationsEnabled(saved !== 'false') }, [])

  // ============================================================
  // RENDERIZAÇÃO
  // ============================================================
  const renderSection = (sectionId: string) => {
    const sectionLabel = ALL_SECTIONS.find(s => s.id === sectionId)?.label || sectionId
    const isFixed = FIXED_SECTIONS.includes(sectionId)

    switch (sectionId) {
      case 'balance':
        return (
          <div key="balance" className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-slate-700/50 text-center transition-all">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Saldo total</span>
                <button onClick={() => setHideBalance(!hideBalance)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <h1 className={`text-[36px] font-light text-gray-800 dark:text-gray-100 tracking-tight ${hideBalance ? 'tracking-widest' : ''}`}>
                {hideBalance ? '••••••' : formatCurrency(totalAccountsBalance)}
              </h1>
              {!hideBalance && previousBalance !== 0 && (
                <div className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                  balanceVariation >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                }`}>
                  {balanceVariation >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {balanceVariation >= 0 ? '+' : ''}{balanceVariation.toFixed(1)}% vs. mês anterior
                </div>
              )}
            </div>
          </div>
        )
      case 'income-expense':
        return (
          <div key="income-expense" className="mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div onClick={() => router.push('/transactions?filter=income')} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/50 shadow-sm rounded-[24px] p-5 flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-3">
                  <ArrowUp size={20} className="text-emerald-500" />
                </div>
                <span className="text-[12px] text-gray-500 dark:text-gray-400 font-bold mb-1 uppercase tracking-wider">Receitas</span>
                <p className="text-[16px] font-bold text-emerald-600">{hideBalance ? '••••' : formatCurrency(summary.income)}</p>
              </div>
              <div onClick={() => router.push('/transactions?filter=expense')} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/50 shadow-sm rounded-[24px] p-5 flex flex-col items-center justify-center cursor-pointer hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-3">
                  <ArrowDown size={20} className="text-red-500" />
                </div>
                <span className="text-[12px] text-gray-500 dark:text-gray-400 font-bold mb-1 uppercase tracking-wider">Despesas</span>
                <p className="text-[16px] font-bold text-red-500">{hideBalance ? '••••' : formatCurrency(summary.expense)}</p>
              </div>
            </div>
          </div>
        )
      case 'projection':
        return (
          <div key="projection" className="mb-6 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard('projection', 'Projeção de Saldo')}
                className="absolute -top-1 right-0 p-1 text-gray-300/70 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition z-10"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}
            <Suspense fallback={<Skeleton count={1} className="h-24 w-full rounded-[24px]" />}>
              <ProjectionSparklineCard />
            </Suspense>
          </div>
        )
      case 'loans':
        if (appMode === 'personal_only') return null
        if (loans.length === 0) return null
        return (
          <div key="loans" className="mb-6 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard('loans', 'Empréstimos entre Contextos')}
                className="absolute -top-1 right-0 p-1 text-gray-300/70 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition z-10"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/loans')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Empréstimos entre Contextos</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {loans.slice(0, 3).map((loan: any) => {
                  const progress = Number(loan.total_amount) > 0 ? ((Number(loan.total_amount) - Number(loan.remaining_amount)) / Number(loan.total_amount)) * 100 : 0
                  const isOverdue = loan.due_date && differenceInDays(new Date(loan.due_date), today) < 0
                  return (
                    <div key={loan.id} onClick={() => router.push(`/loans/${loan.id}`)} className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                        <ArrowRightLeft size={18} className="text-teal-600 dark:text-teal-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5">
                            {getContextIcon(loan.source_context)}
                            <span className="text-[11px] text-gray-500">{getContextLabel(loan.source_context)}</span>
                            <ArrowRightLeft size={10} className="text-gray-400" />
                            {getContextIcon(loan.dest_context)}
                            <span className="text-[11px] text-gray-500">{getContextLabel(loan.dest_context)}</span>
                          </div>
                          <p className="text-[14px] font-bold text-teal-600 ml-2 shrink-0">{formatCurrency(Number(loan.remaining_amount) || 0)}</p>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mb-1">
                          <div className={`h-full rounded-full transition-all duration-700 ${isOverdue ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-gray-400">{loan.paid_installments}/{loan.total_installments} parcelas</span>
                          <span className="text-[11px] font-bold text-gray-500">{progress.toFixed(0)}% pago</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      case 'next-card':
        if (!nextCard && !allCardsPaid) return null
        return (
          <div key="next-card" className="mb-6 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard('next-card', 'Próxima Fatura')}
                className="absolute -top-1 right-0 p-1 text-gray-300/70 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition z-10"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}
            {nextCard ? (
              <div onClick={() => router.push(`/cards/${nextCard.id}`)} className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700/50 cursor-pointer hover:shadow-md transition-all flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[18px] bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-0.5">Próxima Fatura</p>
                    <p className="text-[15px] font-bold text-gray-800 dark:text-gray-200">{nextCard.name}</p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500 font-medium">Vence dia {nextCard.due_day}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-[16px] font-bold ${(nextCard.faturaAtual || 0) > 0 ? 'text-orange-500' : 'text-gray-800 dark:text-gray-200'}`}>
                    {hideBalance ? '••••' : formatCurrency(nextCard.faturaAtual || 0)}
                  </p>
                </div>
              </div>
            ) : allCardsPaid ? (
              <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-emerald-100 dark:border-emerald-900 text-center">
                <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Check size={20} />
                  <span className="font-bold text-sm">Tudo em dia!</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Todas as faturas estão pagas.</p>
              </div>
            ) : null}
          </div>
        )
      case 'pendings':
        return (
          <div key="pendings" className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700/50">
              <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100 mb-4 px-1">Pendências</h3>
              <div className="grid grid-cols-3 gap-3">
                <div onClick={() => router.push('/transactions?filter=expense')} className="text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-2xl py-3 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-2 text-red-500">
                    <ArrowDown size={18} />
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold mb-1 uppercase tracking-wider">A Pagar</p>
                  <p className="text-[14px] font-bold text-red-500">{hideBalance ? '•••' : formatCurrency(pendings.toPay)}</p>
                </div>
                <div onClick={() => router.push('/transactions?filter=income')} className="text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-2xl py-3 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-2 text-emerald-500">
                    <ArrowUp size={18} />
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold mb-1 uppercase tracking-wider">Receber</p>
                  <p className="text-[14px] font-bold text-emerald-600">{hideBalance ? '•••' : formatCurrency(pendings.toReceive)}</p>
                </div>
                <div onClick={() => router.push('/cards')} className="text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-2xl py-3 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center mx-auto mb-2 text-orange-500">
                    <CreditCard size={18} />
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold mb-1 uppercase tracking-wider">Faturas</p>
                  <p className="text-[14px] font-bold text-orange-500">{hideBalance ? '•••' : formatCurrency(pendings.faturas)}</p>
                </div>
              </div>
            </div>
          </div>
        )
      case 'receivables':
        if (debtsList.length === 0) return null
        return (
          <div key="receivables" className="mb-6 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard('receivables', 'A Receber')}
                className="absolute -top-1 right-0 p-1 text-gray-300/70 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition z-10"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/debts')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">A Receber</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {debtsList.slice(0, 3).map((debt: any) => {
                  const IconComp = getDynamicIcon(debt.icon || 'user')
                  const remaining = Number(debt.total_amount) - (debt.paid_amount || 0)
                  const daysUntilDue = debt.due_date ? differenceInDays(new Date(debt.due_date), today) : null
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
                  const percent = Math.min(debt.percent, 100)
                  return (
                    <div key={debt.id} onClick={() => router.push(`/debts/${debt.id}`)} className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors">
                      <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${debt.color}15`, color: debt.color }}>
                        <IconComp size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100 truncate">{debt.person_name}</p>
                          <p className="text-[15px] font-bold text-emerald-600 ml-2 shrink-0">{formatCurrency(remaining)}</p>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mb-1">
                          <div className={`h-full rounded-full transition-all duration-700 ${isOverdue ? 'bg-red-500' : remaining <= 0 ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${percent}%` }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`text-[11px] font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                            {isOverdue ? `Atrasado ${Math.abs(daysUntilDue)} dia(s)` : debt.due_date ? `Vence ${format(new Date(debt.due_date), "dd/MM")}` : 'Sem prazo'}
                          </span>
                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{percent.toFixed(0)}% pago</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      case 'financings':
        if (financings.length === 0) return null
        return (
          <div key="financings" className="mb-6 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard('financings', 'Financiamentos')}
                className="absolute -top-1 right-0 p-1 text-gray-300/70 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition z-10"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/financings')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Financiamentos</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {financings.slice(0, 3).map((fin: any) => {
                  const IconComp = getDynamicIcon(fin.icon || 'home')
                  const remaining = fin.total_installments - fin.current_installment + 1
                  const isOverdue = fin.next_due_date && differenceInDays(new Date(fin.next_due_date), today) < 0
                  return (
                    <div key={fin.id} onClick={() => router.push(`/financings/${fin.id}`)} className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${fin.color}15`, color: fin.color }}><IconComp size={20} /></div>
                        <div>
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{fin.name}</p>
                          <p className={`text-[12px] font-medium mt-0.5 ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>{remaining} px de {formatCurrency(Number(fin.installment_value))}</p>
                        </div>
                      </div>
                      <div className="w-16 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden ml-auto"><div className={`h-full rounded-full ${isOverdue ? 'bg-red-500' : 'bg-teal-500'}`} style={{ width: `${Math.min((fin.current_installment / fin.total_installments) * 100, 100)}%` }} /></div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      case 'budgets':
        if (budgets.length === 0) return null
        return (
          <div key="budgets" className="mb-6 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard('budgets', 'Orçamentos')}
                className="absolute -top-1 right-0 p-1 text-gray-300/70 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition z-10"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/budgets')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Orçamentos Ativos</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {budgets.map((budget: any) => {
                  const IconComp = getDynamicIcon(budget.icon)
                  const isWarning = budget.percent >= 80 && budget.remaining >= 0
                  const isDanger = budget.remaining < 0
                  return (
                    <div key={budget.id} onClick={() => router.push(`/budgets/${budget.id}`)} className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                      <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${budget.color}15`, color: budget.color }}><IconComp size={20} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100 truncate">{budget.name}</p>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                            isDanger ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' :
                            isWarning ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' :
                            'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                          }`}>
                            {isDanger && <AlertTriangle size={10} />}
                            {isDanger ? 'Estourado' : isWarning ? 'Atenção' : 'Seguro'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mb-1.5"><div className={`h-full rounded-full transition-all duration-500 ${isDanger ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(budget.percent, 100)}%` }} /></div>
                        <div className="flex justify-between text-[11px] font-medium text-gray-400 dark:text-gray-500"><span>Usado: {formatCurrency(budget.spent)}</span><span>Limite: {formatCurrency(Number(budget.amount))}</span></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      case 'accounts':
        return (
          <div key="accounts" className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/accounts')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Contas</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {accounts.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 dark:text-gray-500 text-[13px] font-medium">Nenhuma conta registada.</div>
                ) : (
                  <>
                    {accounts.map((acc: any) => (
                      <div key={acc.id} onClick={() => router.push(`/accounts/${acc.id}`)} className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors">
                        <div className="flex items-center gap-4">
                          <BankLogo color={acc.color} name={acc.name} size="md" />
                          <div>
                            <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{acc.name}</p>
                            <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">Saldo Previsto</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-[15px] ${getBalanceStyle(Number(acc.balance) || 0)}`}>{hideBalance ? '••••' : formatCurrency(Number(acc.balance) || 0)}</p>
                          <p className={`text-[12px] font-bold mt-0.5 ${(acc.previsto || 0) >= 0 ? 'text-gray-400 dark:text-gray-500' : 'text-red-400'}`}>{hideBalance ? '••••' : formatCurrency(acc.previsto || 0)}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        )
      case 'cards':
        return (
          <div key="cards" className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/cards')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Cartões de Crédito</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {cards.length === 0 ? (
                  <button onClick={() => router.push('/cards/new')} className="w-full p-4 flex items-center justify-center gap-2 text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/10 rounded-[16px] transition-colors text-sm font-bold">
                    <Plus size={18} /> Adicionar cartão
                  </button>
                ) : (
                  cards.map((card: any) => (
                    <div key={card.id} onClick={() => router.push(`/cards/${card.id}`)} className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[16px] flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: card.color || '#f97316' }}><CreditCard size={20} /></div>
                        <div>
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{card.name}</p>
                          <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">Fatura atual</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-[15px] font-bold ${(card.faturaAtual || 0) > 0 ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}`}>{hideBalance ? '••••' : formatCurrency(card.faturaAtual || 0)}</p>
                        <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">Vence dia {card.due_day}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      case 'recent':
        return (
          <div key="recent" className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/transactions')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Transações Recentes</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {recentTransactions.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 dark:text-gray-500 text-[13px] font-medium">Nenhuma transação registada.</div>
                ) : (
                  recentTransactions.map((tx: any, index: number) => {
                    const isPending = tx.status === 'pending'
                    const IconComp = getDynamicIcon(tx.categories?.icon)
                    const attachmentIcon = getAttachmentIcon(tx.receipt_url)
                    return (
                      <div key={tx.id} onClick={() => router.push(`/transactions/${tx.id}`)} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors gap-3 ${isPending ? 'bg-amber-50 dark:bg-amber-900/10' : ''} ${index !== recentTransactions.length - 1 ? 'border-b border-gray-50 dark:border-slate-700' : ''}`}>
                        {isPending ? <div className="w-5 h-5 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0"><Clock size={12} className="text-orange-500" /></div> : <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0"><Check size={12} className="text-emerald-500" /></div>}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${tx.categories?.color || '#94a3b8'}15`, color: tx.categories?.color || '#64748b' }}><IconComp size={18} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100 uppercase tracking-tight truncate">{tx.description || tx.categories?.name || (tx.type === 'income' ? 'Receita' : 'Despesa')}</p>
                              {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
                            </div>
                            <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 truncate">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })} • {tx.categories?.name || 'Geral'}</p>
                          </div>
                        </div>
                        <p className={`text-[15px] font-bold whitespace-nowrap shrink-0 ${tx.type === 'income' ? 'text-emerald-600' : 'text-gray-800 dark:text-gray-200'}`}>{tx.type === 'income' ? '+' : '-'} {hideBalance ? '••••' : formatCurrency(Number(tx.amount) || 0)}</p>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  if (isInitialLoad || (isDataLoading && !localTransactions?.length && !localAccountsData?.length)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pt-6">
        <Skeleton count={1} className="h-10 w-full mb-6" />
        <Skeleton count={1} className="h-32 w-full rounded-[32px] mb-6" />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Skeleton count={1} className="h-24 w-full rounded-[24px]" />
          <Skeleton count={1} className="h-24 w-full rounded-[24px]" />
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-28 font-sans relative px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {undoToast && (
        <UndoToast
          message={undoToast.message}
          onUndo={undoToast.onUndo}
          onDismiss={() => setUndoToast(null)}
          duration={3000}
        />
      )}

      <NetworkStatus isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />

      {cards.length > 0 && (
        <div className="mb-4 space-y-2">
          {cards.map((card: any) => (
            <InvoiceAlert key={card.id} dueDay={card.due_day} closingDay={card.closing_day} cardName={card.name} />
          ))}
        </div>
      )}

      {debtsList
        .filter((d: any) => d.due_date && differenceInDays(new Date(), new Date(d.due_date)) > 0 && d.status !== 'paid')
        .map((debt: any) => (
          <DebtAlert
            key={debt.id}
            personName={debt.person_name}
            amount={Number(debt.total_amount) - (debt.paid_amount || 0)}
            dueDate={debt.due_date}
            debtId={debt.id}
          />
        ))}

      <div className="flex justify-between items-center mb-8">
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            {greeting.icon}
            <span className="text-sm font-medium truncate">{greeting.text}, {firstName}</span>
          </div>
          <ContextToggle />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SyncButton pendingCount={pendingCount} isSyncing={isSyncing} onSync={syncQueue} />
          {notificationsEnabled && (
            <NotificationBell count={unreadNotifications} hasCritical={criticalCount > 0} onClick={() => setShowNotifications(true)} />
          )}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700/50 px-2 py-1.5 rounded-[16px]">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 text-gray-400 hover:text-gray-800 dark:text-gray-500 dark:hover:text-gray-200 transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize w-[80px] text-center">{monthLabel}</span>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 text-gray-400 hover:text-gray-800 dark:text-gray-500 dark:hover:text-gray-200 transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {enabledSections.map(sectionId => renderSection(sectionId))}

      <button
        onClick={openPersonalize}
        className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-[24px] bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-700 border border-teal-100 dark:border-slate-700 shadow-sm transition-all"
      >
        <Settings2 size={20} />
        <span className="font-bold text-[15px]">Personalizar Dashboard</span>
      </button>

      <FAB onSave={() => Promise.all([reloadTxs(), reloadNotifs()])} />
      <PersonalizeModal
        isOpen={showPersonalizeModal}
        onClose={() => setShowPersonalizeModal(false)}
        sections={ALL_SECTIONS}
        enabled={personalizeEnabled}
        order={personalizeOrder}
        onToggle={toggleSection}
        onMove={moveSection}
        onSave={handleSavePersonalize}
      />

      {notificationsEnabled && (
        <NotificationCenter
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notificationsMap}
          onReadChange={() => reloadNotifs()}
        />
      )}
    </div>
  )
}

export default function HomePage() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])
  if (!isClient) return <div className="min-h-screen bg-gray-50 dark:bg-slate-900" />
  return (
    <ContextProvider>
      <HomeContent />
    </ContextProvider>
  )
}