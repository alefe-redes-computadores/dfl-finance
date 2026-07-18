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
import InvoiceAlert from '@/components/InvoiceAlert'
import DebtAlert from '@/components/DebtAlert'
import NotificationBell from '@/components/NotificationBell'
import NotificationCenter from '@/components/NotificationCenter'
import SyncButton from '@/components/SyncButton'
import SyncStatusModal from '@/components/SyncStatusModal'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
import FAB from '@/components/FAB'
import PersonalizeModal from '@/components/PersonalizeModal'
import Skeleton from '@/components/Skeleton'
import { UndoToast } from '@/components/ui/UndoToast'
import { useLocalData } from '@/hooks/useLocalData'

// ✅ IMPORTANDO OS HOOKS ESPECÍFICOS
import { useTransactionsList } from '@/hooks/useTransactionsList'
import { useAccountsList } from '@/hooks/useAccountsList'
import { useDebtsList } from '@/hooks/useDebtsList'
import { useFinancingsList } from '@/hooks/useFinancingsList'
import { useCardsList } from '@/hooks/useCardsList'
import { useBudgetsList } from '@/hooks/useBudgetsList'
import { useLoansList } from '@/hooks/useLoansList'

import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  safeNumber,
  safeDate,
  safeFormatDate,
  safeArray,
  safeNavigate,
} from '@/lib/safe'

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
  const { context, appMode, effectiveContext } = useContext_()
  const { showToast } = useToast()
  const { success: hapticSuccess, vibrate } = useHapticFeedback()
  
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isClient, setIsClient] = useState(false)

  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const [enabledSections, setEnabledSections] = useState<string[]>(DEFAULT_SECTION_ORDER)
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false)
  const [personalizeOrder, setPersonalizeOrder] = useState<typeof ALL_SECTIONS>(ALL_SECTIONS)
  const [personalizeEnabled, setPersonalizeEnabled] = useState<Set<string>>(new Set(DEFAULT_SECTION_ORDER))

  const [undoToast, setUndoToast] = useState<{ message: string; onUndo: () => void } | null>(null)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)

  const { isOnline = true, pendingCount = 0, isSyncing = false, syncQueue = async () => {} } = useOfflineQueue() || {}

  // ========== CLIENTE ==========
  useEffect(() => {
    setIsClient(true)
  }, [])

  // ========== LOCALSTORAGE (seguro) ==========
  useEffect(() => {
    const saved = localStorage.getItem('dfl_notifications_enabled')
    setNotificationsEnabled(saved !== 'false')
  }, [])

  const monthLabel = format(currentDate, 'MMMM', { locale: ptBR })
  const greeting = getGreeting()
  const firstName = (user?.user_metadata?.name || 'Visitante').split(' ')[0]

  // ========== ✅ DADOS LOCAIS COM HOOKS ESPECÍFICOS ==========
  
  // ✅ UseTransactionsList em vez de useLocalData
  const { data: rawTransactions, loading: txLoading, reload: reloadTxs } = useTransactionsList(effectiveContext)
  
  // ✅ UseAccountsList em vez de useLocalData
  const { data: rawAccounts, loading: accLoading } = useAccountsList(effectiveContext)
  
  // ✅ UseDebtsList em vez de useLocalData
  const { data: rawDebts, loading: debtsLoading } = useDebtsList(effectiveContext)
  
  // ✅ UseFinancingsList em vez de useLocalData
  const { data: rawFinancings, loading: finLoading } = useFinancingsList(effectiveContext)
  
  // ✅ UseCardsList em vez de useLocalData
  const { data: rawCards, loading: cardsLoading } = useCardsList(effectiveContext)
  
  // ✅ UseBudgetsList em vez de useLocalData
  const { data: rawBudgets, loading: budgetsLoading } = useBudgetsList(effectiveContext)
  
  // ✅ UseLoansList em vez de useLocalData
  const { data: rawLoans, loading: loansLoading } = useLoansList(effectiveContext)
  
  // ✅ Mantém useLocalData apenas para categorias (não tem hook específico) e notifications
  const { data: rawCategories, loading: catLoading } = useLocalData({ 
    table: 'categories' as any, 
    filters: { context: effectiveContext }
  })
  
  const { data: rawNotifications, reload: reloadNotifs } = useLocalData({
    table: 'notifications' as any,
    filters: { user_id: user?.id }
  })

  // ========== NORMALIZAÇÃO DE ARRAYS ==========
  const localTransactions = safeArray<any>(rawTransactions)
  const localCategories = safeArray<any>(rawCategories)
  const localAccountsData = safeArray<any>(rawAccounts)
  const localDebts = safeArray<any>(rawDebts)
  const localFinancings = safeArray<any>(rawFinancings)
  const localCards = safeArray<any>(rawCards)
  const localBudgets = safeArray<any>(rawBudgets)
  const localLoans = safeArray<any>(rawLoans)
  const localNotifications = safeArray<any>(rawNotifications)

  const isDataLoading = txLoading || catLoading || accLoading || debtsLoading || finLoading || cardsLoading || budgetsLoading || loansLoading

  useEffect(() => {
    setLoadingPulse(isDataLoading)
  }, [isDataLoading])

  useEffect(() => {
    if (!isDataLoading && (localTransactions.length || localAccountsData.length)) {
      setIsInitialLoad(false)
    }
  }, [isDataLoading, localTransactions, localAccountsData])

  // ========== DATAS SEGURAS ==========
  const start = useMemo(() => format(startOfMonth(currentDate), 'yyyy-MM-dd'), [currentDate])
  const end = useMemo(() => format(endOfMonth(currentDate), 'yyyy-MM-dd'), [currentDate])
  const today = useMemo(() => new Date(), [])

  // ========== JOIN SEGURO ==========
  const transactionsWithJoin = useMemo(() => {
    return localTransactions.map((tx: any) => {
      const category = localCategories.find((c: any) => c.id === tx.category_id) as any
      const account = localAccountsData.find((a: any) => a.id === tx.account_id) as any
      return {
        ...tx,
        categories: category ? { name: category.name, icon: category.icon, color: category.color } : null,
        accounts: account ? { name: account.name, color: account.color } : null,
      }
    })
  }, [localTransactions, localCategories, localAccountsData])

  // ========== FILTRO MÊS ==========
  const monthTransactions = useMemo(() => 
    transactionsWithJoin
      .filter((t: any) => t.date >= start && t.date <= end)
      .sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || a.date || 0).getTime()
        const timeB = new Date(b.created_at || b.date || 0).getTime()
        return timeB - timeA
      }),
  [transactionsWithJoin, start, end])

  // ========== RESUMO (safeNumber) ==========
  const summary = useMemo(() => {
    const income = monthTransactions
      .filter((t: any) => t.type === 'income' && t.status === 'done')
      .reduce((a: number, t: any) => a + safeNumber(t.amount), 0)
    const expense = monthTransactions
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
      .reduce((a: number, t: any) => a + safeNumber(t.amount), 0)
    return { income, expense, balance: income - expense }
  }, [monthTransactions])

  // ========== VARIAÇÃO ==========
  const { previousBalance, balanceVariation } = useMemo(() => {
    const prevMonthDate = subMonths(currentDate, 1)
    const prevStart = format(startOfMonth(prevMonthDate), 'yyyy-MM-dd')
    const prevEnd = format(endOfMonth(prevMonthDate), 'yyyy-MM-dd')
    const prevMonthTxs = transactionsWithJoin.filter((t: any) => t.date >= prevStart && t.date <= prevEnd)
    
    const prevInc = prevMonthTxs
      .filter((t: any) => t.type === 'income' && t.status === 'done')
      .reduce((a, t) => a + safeNumber(t.amount), 0)
    const prevExp = prevMonthTxs
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
      .reduce((a, t) => a + safeNumber(t.amount), 0)
    const prevBal = prevInc - prevExp
    
    const variation = prevBal !== 0 ? ((summary.balance - prevBal) / Math.abs(prevBal)) * 100 : (summary.balance > 0 ? 100 : summary.balance < 0 ? -100 : 0)
    return { previousBalance: prevBal, balanceVariation: variation }
  }, [transactionsWithJoin, currentDate, summary.balance])

  // ========== RECENTES ==========
  const recentTransactions = useMemo(() => monthTransactions.slice(0, 5), [monthTransactions])

  // ========== CONTAS ==========
  const accounts = useMemo(() => {
    return localAccountsData.map((acc: any) => {
      const accTxs = monthTransactions.filter((t: any) => t.account_id === acc.id && t.status === 'pending')
      const pendingIncome = accTxs
        .filter((t: any) => t.type === 'income')
        .reduce((a: number, t: any) => a + safeNumber(t.amount), 0)
      const pendingExpense = accTxs
        .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
        .reduce((a: number, t: any) => a + safeNumber(t.amount), 0)
      const previsto = safeNumber(acc.balance) + pendingIncome - pendingExpense
      return { ...acc, previsto }
    })
  }, [localAccountsData, monthTransactions])

  // ========== CARTÕES ==========
  const cards = useMemo(() => {
    return localCards.map((card: any) => {
      const cardTxs = monthTransactions.filter((t: any) => t.credit_card_id === card.id)
      const faturaAtual = cardTxs.reduce((acc: number, t: any) => acc + safeNumber(t.amount), 0)
      return { ...card, faturaAtual }
    })
  }, [localCards, monthTransactions])

  // ========== PENDÊNCIAS ==========
  const pendings = useMemo(() => {
    const allPending = localTransactions.filter((t: any) => t.status === 'pending')
    
    const toPay = allPending
      .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && !t.credit_card_id)
      .reduce((a: number, t: any) => a + safeNumber(t.amount), 0)
      
    const toReceive = allPending
      .filter((t: any) => t.type === 'income')
      .reduce((a: number, t: any) => a + safeNumber(t.amount), 0)
      
    const faturas = cards.reduce((acc: number, c: any) => acc + (c.faturaAtual || 0), 0)
    
    return { toPay, toReceive, faturas }
  }, [localTransactions, cards])

  // ========== DÍVIDAS (✅ agora usando useDebtsList) ==========
  const debtsList = useMemo(() => {
    const allDebts = localDebts.map((debt: any) => {
      const payments = localTransactions.filter((t: any) => t.debt_id === debt.id && t.type === 'income')
      const paidAmount = payments.reduce((sum: number, p: any) => sum + safeNumber(p.amount), 0)
      const totalAmount = safeNumber(debt.total_amount)
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

  // ========== FINANCIAMENTOS ==========
  const financings = localFinancings

  // ========== ORÇAMENTOS ==========
  const budgets = useMemo(() => {
    const budgetsWithSpent = localBudgets.map((budget: any) => {
      const cat = localCategories.find((c: any) => c.id === budget.category_id) as any
      const spent = monthTransactions
        .filter((t: any) => t.category_id === budget.category_id && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
        .reduce((a: number, t: any) => a + safeNumber(t.amount), 0)
      const remaining = safeNumber(budget.amount) - spent
      const percent = safeNumber(budget.amount) > 0 ? (spent / safeNumber(budget.amount)) * 100 : 0
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

  // ========== EMPRÉSTIMOS ==========
  const loans = useMemo(() => {
    return localLoans
      .filter((l: any) => l.status === 'active' || l.status === 'completed')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [localLoans])

  // ========== NOTIFICAÇÕES ==========
  const notificationsMap = useMemo(() => {
    return localNotifications
      .map((n: any) => ({ ...n, isRead: n.is_read || n.isRead, cardId: n.card_id || n.cardId }))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [localNotifications])

  const unreadNotifications = useMemo(() => notificationsMap.filter((n: any) => !n.isRead).length, [notificationsMap])
  const criticalCount = useMemo(() => notificationsMap.filter((n: any) => n.severity === 'critical' && !n.isRead).length, [notificationsMap])

  // ========== GERAR NOTIFICAÇÕES DE FATURA ==========
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

  // ========== CARREGAR LAYOUT ==========
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

  // ========== PULL TO REFRESH ==========
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
      vibrate(10)
      await reloadTxs()
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

  // ========== PERSONALIZAÇÃO ==========
  const toggleSection = (id: string) => { setPersonalizeEnabled(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const moveSection = (id: string, direction: 'up' | 'down') => { setPersonalizeOrder((prev) => { const currentIndex = prev.findIndex((item) => item.id === id); if (currentIndex === -1) return prev; const newOrder = [...prev]; const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1; if (targetIndex >= 0 && targetIndex < newOrder.length) { [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]] } return newOrder }) }
  const handleSavePersonalize = () => { const finalOrder = personalizeOrder.filter(s => personalizeEnabled.has(s.id)).map(s => s.id); saveLayout(finalOrder); setShowPersonalizeModal(false); showToast('✅ Tela inicial personalizada!', 'success'); hapticSuccess() }
  const openPersonalize = () => { const enabledOrder = enabledSections.map(id => ALL_SECTIONS.find(s => s.id === id)).filter(Boolean) as typeof ALL_SECTIONS; const missing = ALL_SECTIONS.filter(s => !enabledSections.includes(s.id)); setPersonalizeOrder([...enabledOrder, ...missing]); setPersonalizeEnabled(new Set(enabledSections)); setShowPersonalizeModal(true) }

  // ========== UTILITÁRIOS ==========
  const formatCurrency = (val: number) => `R$ ${safeNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const totalAccountsBalance = accounts.reduce((acc, curr) => acc + safeNumber(curr.balance), 0)
  
  const sortedByDue = [...cards].sort((a, b) => { const todayDay = today.getDate(); const aDue = a.due_day < todayDay ? a.due_day + 31 : a.due_day; const bDue = b.due_day < todayDay ? b.due_day + 31 : b.due_day; return aDue - bDue })
  const nextCard = sortedByDue.length > 0 ? sortedByDue[0] : null
  const allCardsPaid = cards.length > 0 && cards.every((c) => (c.faturaAtual || 0) === 0)

  const getAttachmentIcon = (url: string | null) => { 
    if (!url) return null; 
    const isDocument = /\.(pdf|doc|docx|xls|xlsx|csv|txt)(\?|$)/i.test(url.toLowerCase()); 
    if (isDocument) return <Paperclip size={12} className="text-gray-500 shrink-0" />; 
    return <Image size={12} className="text-blue-500 shrink-0" />; 
  }

  const handleHideCard = (sectionId: string, sectionLabel: string) => {
    const removedSection = sectionId
    const removedLabel = sectionLabel
    setEnabledSections(prev => prev.filter(id => id !== removedSection))
    vibrate(10)
    setUndoToast({ message: `"${removedLabel}" ocultado`, onUndo: () => { setEnabledSections(prev => { const restored = [...prev, removedSection]; return restored.sort((a, b) => { const idxA = ALL_SECTIONS.findIndex(s => s.id === a); const idxB = ALL_SECTIONS.findIndex(s => s.id === b); return idxA - idxB }) }); showToast(`✅ "${removedLabel}" restaurado`, 'success'); setUndoToast(null) } })
    setTimeout(() => { setEnabledSections(current => { if (!current.includes(removedSection)) saveLayout(current); return current }); setUndoToast(null) }, 3500)
  }

  const getBalanceStyle = (val: number) => { if (val > 0) return 'text-emerald-600 font-semibold'; if (val < 0) return 'text-red-500 font-semibold'; return 'text-gray-800 dark:text-gray-200 font-semibold' }

  // ========== NAVEGAÇÃO SEGURA ==========
  const goToTransaction = (id?: string) => { if (!id) return; safeNavigate(router, '/transactions/details', id) }
  const goToLoan = (id?: string) => { if (!id) return; safeNavigate(router, '/loans/details', id) }
  const goToCard = (id?: string) => { if (!id) return; safeNavigate(router, '/cards/details', id) }
  const goToDebt = (id?: string) => { if (!id) return; safeNavigate(router, '/debts/details', id) }
  const goToFinancing = (id?: string) => { if (!id) return; safeNavigate(router, '/financings/details', id) }
  const goToBudget = (id?: string) => { if (!id) return; safeNavigate(router, '/budgets/details', id) }
  const goToAccount = (id?: string) => { if (!id) return; safeNavigate(router, '/accounts/details', id) }

  // ========== RENDERIZAÇÃO DE SEÇÕES ==========
  // ... (mantém o mesmo código de renderização, não mudou nada)

  // ========== RENDERIZAÇÃO PRINCIPAL ==========
  // ... (mantém o mesmo código de renderização)

  return (
    // ... (mantém o mesmo JSX)
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