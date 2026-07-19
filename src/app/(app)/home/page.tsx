// src/app/(app)/home/page.tsx
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
import { useLocalSync } from '@/hooks/useLocalSync'
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

  // ========== ✅ LINHAS RESTAURADAS (eram as que faltavam) ==========
  const monthLabel = format(currentDate, 'MMMM', { locale: ptBR })
  const greeting = getGreeting()
  const firstName = (user?.user_metadata?.name || 'Visitante').split(' ')[0]
  // ===============================================================

  const [refreshing, setRefreshing] = useState(false)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const [syncAttempted, setSyncAttempted] = useState(false)

  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  const [enabledSections, setEnabledSections] = useState<string[]>(DEFAULT_SECTION_ORDER)
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false)
  const [personalizeOrder, setPersonalizeOrder] = useState<typeof ALL_SECTIONS>(ALL_SECTIONS)
  const [personalizeEnabled, setPersonalizeEnabled] = useState<Set<string>>(new Set(DEFAULT_SECTION_ORDER))

  const [undoToast, setUndoToast] = useState<{ message: string; onUndo: () => void } | null>(null)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)

  // ✅ useLocalSync - contém pullRemoteChanges()
  const { isOnline, pendingCount, isSyncing, forceSync } = useLocalSync()

  // ========== CLIENTE ==========
  useEffect(() => {
    setIsClient(true)
  }, [])

  // ========== LOCALSTORAGE ==========
  useEffect(() => {
    const saved = localStorage.getItem('dfl_notifications_enabled')
    setNotificationsEnabled(saved !== 'false')
  }, [])

  // ========== ✅ DADOS LOCAIS COM useLocalData ==========
  const { data: rawTransactions, loading: txLoading, reload: reloadTxs } = useLocalData({ 
    table: 'transactions' as any, 
    filters: { context: effectiveContext },
  })
  const { data: rawCategories, loading: catLoading } = useLocalData({ 
    table: 'categories' as any, 
    filters: { context: effectiveContext }
  })
  const { data: rawAccounts, loading: accLoading, reload: reloadAccounts } = useLocalData({ 
    table: 'accounts' as any, 
    filters: { context: effectiveContext }
  })

  const { data: rawDebts, loading: debtsLoading, reload: reloadDebts } = useLocalData({ 
    table: 'debts' as any, 
    filters: { context: effectiveContext }
  })

  const { data: rawFinancings, loading: finLoading } = useLocalData({ 
    table: 'financings' as any, 
    filters: { context: effectiveContext, status: 'active' }
  })
  const { data: rawCards, loading: cardsLoading } = useLocalData({ 
    table: 'credit_cards' as any, 
    filters: { context: effectiveContext, is_archived: false }
  })
  const { data: rawBudgets, loading: budgetsLoading } = useLocalData({
    table: 'budgets' as any,
    filters: { context: effectiveContext }
  })
  const { data: rawLoans, loading: loansLoading } = useLocalData({
    table: 'loans' as any,
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

  // ============================================================
  // ✅ DEFINIÇÃO DE isDataLoading (ANTES DOS USEEFFECTS QUE DEPENDEM)
  // ============================================================
  const isDataLoading = txLoading || catLoading || accLoading || debtsLoading || finLoading || cardsLoading || budgetsLoading || loansLoading

  // ========== ✅ CORREÇÃO 1: FORÇAR SYNC NA MONTAGEM ==========
  useEffect(() => {
    if (user?.id && isOnline && isClient && !syncAttempted) {
      console.log('🏠 Home: Disparando sync automático...')
      const timer = setTimeout(() => {
        forceSync().then(() => {
          console.log('✅ Home: Sync automático concluído')
          setSyncAttempted(true)
        }).catch((err) => {
          console.error('❌ Home: Erro no sync automático:', err)
          setSyncAttempted(true)
        })
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [user?.id, isOnline, isClient, syncAttempted, forceSync])

  // ========== ✅ CORREÇÃO 2: LOADING COM TIMEOUT ==========
  useEffect(() => {
    if (!isDataLoading && !syncAttempted) {
      // Dá tempo para o pull trazer dados
      const timer = setTimeout(() => {
        setIsInitialLoad(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isDataLoading, syncAttempted])

  // ========== LOADING PULSE ==========
  useEffect(() => {
    setLoadingPulse(isDataLoading)
  }, [isDataLoading])

  // ========== INICIAL LOAD ==========
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

  // ========== RESUMO ==========
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

  // ========== DÍVIDAS ==========
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

  // ========== ✅ CORREÇÃO 3: PULL TO REFRESH MELHORADO ==========
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
      
      console.log('🔄 Pull-to-refresh: forçando sync...')
      
      // ✅ força o sync completo (push + pullRemoteChanges)
      await forceSync()
      
      // ✅ NÃO PRECISA de reloadTxs/reloadAccounts/reloadDebts
      // O useLiveQuery já vai reagir automaticamente!
      
      setRefreshing(false)
      showToast('✅ Dados atualizados!', 'success')
      hapticSuccess()
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
  }, [isDataLoading, refreshing, forceSync])

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
  const renderSection = (sectionId: string) => {
    const sectionLabel = ALL_SECTIONS.find(s => s.id === sectionId)?.label || sectionId
    const isFixed = FIXED_SECTIONS.includes(sectionId)

    switch (sectionId) {
      case 'balance':
        return (
          <div key="balance" className="mb-5">
            <div className="relative overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-5 shadow-sm">
              <div className="pointer-events-none absolute -right-4 -top-4 opacity-[0.04]">
                <Wallet size={92} />
              </div>

              <div className="relative z-10 flex items-center justify-between gap-3 mb-3">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                    Saldo total
                  </span>
                </div>

                <button
                  onClick={() => {
                    setHideBalance(!hideBalance);
                    vibrate(10);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-slate-700 dark:hover:text-gray-300 active:scale-95"
                >
                  {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="relative z-10">
                <h1
                  className={`text-[32px] leading-none font-light text-gray-900 dark:text-gray-50 ${
                    hideBalance ? "tracking-[0.18em]" : "tracking-tight"
                  }`}
                >
                  {hideBalance ? "••••" : formatCurrency(totalAccountsBalance)}
                </h1>

                {!hideBalance && previousBalance !== 0 && (
                  <div
                    className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      balanceVariation >= 0
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {balanceVariation >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {safeNumber(balanceVariation).toFixed(1)}% vs. mês anterior
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      case 'income-expense':
        return (
          <div key="income-expense" className="mb-5">
            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => router.push("/transactions?filter=income")}
                className="rounded-[22px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.98] cursor-pointer"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
                    <ArrowUp size={18} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    Receitas
                  </span>
                </div>

                <p className="text-[18px] font-bold leading-none text-emerald-600 dark:text-emerald-400">
                  {hideBalance ? "••••" : formatCurrency(summary.income)}
                </p>
              </div>

              <div
                onClick={() => router.push("/transactions?filter=expense")}
                className="rounded-[22px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.98] cursor-pointer"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10">
                    <ArrowDown size={18} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    Despesas
                  </span>
                </div>

                <p className="text-[18px] font-bold leading-none text-red-500 dark:text-red-400">
                  {hideBalance ? "••••" : formatCurrency(summary.expense)}
                </p>
              </div>
            </div>
          </div>
        )
      case 'projection':
        return (
          <div key="projection" className="mb-5 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard('projection', 'Projeção de Saldo')}
                className="absolute -top-1 right-0 p-1 text-gray-300/70 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition z-10 active:scale-95"
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
          <div key="loans" className="mb-5 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard('loans', 'Empréstimos entre Contextos')}
                className="absolute -top-1 right-0 z-10 rounded-full p-1 text-gray-300/70 transition hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300 active:scale-95"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}

            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/loans")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Empréstimos entre Contextos
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="px-2 pb-2">
                {loans.slice(0, 3).map((loan: any) => {
                  const progress = safeNumber(loan.total_amount) > 0 
                    ? ((safeNumber(loan.total_amount) - safeNumber(loan.remaining_amount)) / safeNumber(loan.total_amount)) * 100 
                    : 0;
                  const dueDate = safeDate(loan.due_date)
                  const isOverdue = dueDate ? differenceInDays(dueDate, today) < 0 : false;

                  return (
                    <div
                      key={loan.id}
                      onClick={() => goToLoan(loan.id)}
                      className="rounded-[18px] p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98]"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
                            <ArrowRightLeft size={18} />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                              {getContextIcon(loan.source_context)}
                              <span>{getContextLabel(loan.source_context)}</span>
                              <ArrowRightLeft size={10} className="text-gray-400" />
                              {getContextIcon(loan.dest_context)}
                              <span>{getContextLabel(loan.dest_context)}</span>
                            </div>
                            <p className="mt-1 text-[12px] font-medium text-gray-400 dark:text-gray-500">
                              {safeNumber(loan.paid_installments)}/{safeNumber(loan.total_installments)} parcelas
                            </p>
                          </div>
                        </div>

                        <p className="shrink-0 text-[15px] font-bold text-teal-600 dark:text-teal-400">
                          {hideBalance ? "••••" : formatCurrency(safeNumber(loan.remaining_amount))}
                        </p>
                      </div>

                      <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isOverdue ? "bg-red-500" : "bg-teal-500"
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        <span>{Math.min(progress, 100).toFixed(0)}% pago</span>
                        <span>
                          {loan.due_date ? `Vence ${safeFormatDate(loan.due_date, 'dd/MM')}` : "Sem prazo"}
                        </span>
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
          <div key="next-card" className="mb-5 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard("next-card", "Próxima Fatura")}
                className="absolute -top-1 right-0 z-10 rounded-full p-1 text-gray-300/70 transition hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300 active:scale-95"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}

            {nextCard ? (
              <div
                onClick={() => goToCard(nextCard.id)}
                className="flex items-center justify-between gap-3 rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.98] cursor-pointer"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-orange-50 text-orange-500 dark:bg-orange-500/10">
                    <CreditCard size={20} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                      Próxima fatura
                    </p>
                    <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                      {nextCard.name}
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium text-gray-400 dark:text-gray-500">
                      Vence dia {nextCard.due_day}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`text-[16px] font-bold ${
                      nextCard.faturaAtual > 0 ? "text-orange-500" : "text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    {hideBalance ? "••••" : formatCurrency(safeNumber(nextCard.faturaAtual))}
                  </p>
                </div>
              </div>
            ) : allCardsPaid ? (
              <div className="rounded-[24px] border border-emerald-200/70 dark:border-emerald-900/60 bg-white dark:bg-slate-800 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                    <Check size={18} />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
                      Tudo em dia
                    </p>
                    <p className="text-[12px] text-gray-400 dark:text-gray-500">
                      Todas as faturas estão pagas.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )
      case 'pendings':
        return (
          <div key="pendings" className="mb-5">
            <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
              <h3 className="mb-3 px-1 text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                Pendências
              </h3>

              <div className="grid grid-cols-3 gap-2.5">
                <div
                  onClick={() => router.push("/transactions?filter=expense")}
                  className="cursor-pointer rounded-[18px] px-3 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-95"
                >
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-500/10">
                    <ArrowDown size={16} />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    A pagar
                  </p>
                  <p className="mt-1 text-[14px] font-bold text-red-500 dark:text-red-400">
                    {hideBalance ? "•••" : formatCurrency(pendings.toPay)}
                  </p>
                </div>

                <div
                  onClick={() => router.push("/transactions?filter=income")}
                  className="cursor-pointer rounded-[18px] px-3 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-95"
                >
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
                    <ArrowUp size={16} />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    Receber
                  </p>
                  <p className="mt-1 text-[14px] font-bold text-emerald-600 dark:text-emerald-400">
                    {hideBalance ? "•••" : formatCurrency(pendings.toReceive)}
                  </p>
                </div>

                <div
                  onClick={() => router.push("/cards")}
                  className="cursor-pointer rounded-[18px] px-3 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-95"
                >
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-500 dark:bg-orange-500/10">
                    <CreditCard size={16} />
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                    Faturas
                  </p>
                  <p className="mt-1 text-[14px] font-bold text-orange-500">
                    {hideBalance ? "•••" : formatCurrency(pendings.faturas)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      case 'receivables':
        if (debtsList.length === 0) return null
        return (
          <div key="receivables" className="mb-5 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard("receivables", "A Receber")}
                className="absolute -top-1 right-0 z-10 rounded-full p-1 text-gray-300/70 transition hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300 active:scale-95"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}

            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/debts")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  A Receber
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="px-2 pb-2">
                {debtsList.slice(0, 3).map((debt: any) => {
                  const IconComp = getDynamicIcon(debt.icon || "user");
                  const remaining = safeNumber(debt.total_amount) - debt.paid_amount || 0;
                  const dueDate = safeDate(debt.due_date);
                  const daysUntilDue = dueDate ? differenceInDays(dueDate, today) : null;
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
                  const percent = Math.min(debt.percent, 100);

                  return (
                    <div
                      key={debt.id}
                      onClick={() => goToDebt(debt.id)}
                      className="rounded-[18px] p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98]"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]"
                            style={{ backgroundColor: `${debt.color}15`, color: debt.color }}
                          >
                            <IconComp size={18} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                              {debt.person_name}
                            </p>
                            <p
                              className={`mt-0.5 text-[12px] font-medium ${
                                isOverdue ? "text-red-500" : "text-gray-400 dark:text-gray-500"
                              }`}
                            >
                              {isOverdue
                                ? `Atrasado ${Math.abs(daysUntilDue)} dias`
                                : debt.due_date
                                ? `Vence ${safeFormatDate(debt.due_date, 'dd/MM')}`
                                : "Sem prazo"}
                            </p>
                          </div>
                        </div>

                        <p className="shrink-0 text-[15px] font-bold text-emerald-600 dark:text-emerald-400">
                          {hideBalance ? "••••" : formatCurrency(remaining)}
                        </p>
                      </div>

                      <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            isOverdue ? "bg-red-500" : remaining <= 0 ? "bg-emerald-500" : "bg-teal-500"
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        <span>{percent.toFixed(0)}% pago</span>
                        <span>{hideBalance ? "••••" : formatCurrency(safeNumber(debt.total_amount))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      case 'financings':
        if (financings.length === 0) return null
        return (
          <div key="financings" className="mb-5 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard("financings", "Financiamentos")}
                className="absolute -top-1 right-0 z-10 rounded-full p-1 text-gray-300/70 transition hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300 active:scale-95"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}

            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/financings")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Financiamentos
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="px-2 pb-2">
                {financings.slice(0, 3).map((fin: any) => {
                  const IconComp = getDynamicIcon(fin.icon || "wallet");
                  const remaining = safeNumber(fin.total_installments) - safeNumber(fin.current_installment) + 1;
                  const dueDate = safeDate(fin.next_due_date);
                  const isOverdue = dueDate ? differenceInDays(dueDate, today) < 0 : false;

                  return (
                    <div
                      key={fin.id}
                      onClick={() => goToFinancing(fin.id)}
                      className="rounded-[18px] p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98]"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]"
                            style={{ backgroundColor: `${fin.color}15`, color: fin.color }}
                          >
                            <IconComp size={18} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                              {fin.name}
                            </p>
                            <p
                              className={`mt-0.5 text-[12px] font-medium ${
                                isOverdue ? "text-red-500" : "text-gray-400 dark:text-gray-500"
                              }`}
                            >
                              {remaining} px de {formatCurrency(safeNumber(fin.installment_value))}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 pt-1">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                            <div
                              className={`h-full rounded-full ${
                                isOverdue ? "bg-red-500" : "bg-teal-500"
                              }`}
                              style={{
                                width: `${Math.min(
                                  (safeNumber(fin.current_installment) / safeNumber(fin.total_installments)) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      case 'budgets':
        if (budgets.length === 0) return null
        return (
          <div key="budgets" className="mb-5 relative">
            {!isFixed && (
              <button
                onClick={() => handleHideCard("budgets", "Orçamentos")}
                className="absolute -top-1 right-0 z-10 rounded-full p-1 text-gray-300/70 transition hover:bg-gray-100 hover:text-gray-500 dark:text-gray-600 dark:hover:bg-slate-700 dark:hover:text-gray-300 active:scale-95"
                title="Ocultar card"
              >
                <EyeOff size={14} />
              </button>
            )}

            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/budgets")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Orçamentos Ativos
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="px-2 pb-2">
                {budgets.map((budget: any) => {
                  const IconComp = getDynamicIcon(budget.icon || "wallet");
                  const isWarning = budget.percent >= 80 && budget.remaining > 0;
                  const isDanger = budget.remaining <= 0;

                  return (
                    <div
                      key={budget.id}
                      onClick={() => goToBudget(budget.id)}
                      className="rounded-[18px] p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98]"
                    >
                      <div className="mb-2 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]"
                            style={{ backgroundColor: `${budget.color}15`, color: budget.color }}
                          >
                            <IconComp size={18} />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                              {budget.name}
                            </p>
                            <p className="mt-0.5 text-[12px] font-medium text-gray-400 dark:text-gray-500">
                              Usado {hideBalance ? "••••" : formatCurrency(budget.spent)}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            isDanger
                              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                              : isWarning
                              ? "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                              : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          }`}
                        >
                          {isDanger && <AlertTriangle size={10} />}
                          {isDanger ? "Estourado" : isWarning ? "Atenção" : "Seguro"}
                        </span>
                      </div>

                      <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isDanger ? "bg-red-500" : isWarning ? "bg-orange-500" : "bg-teal-500"
                          }`}
                          style={{ width: `${Math.min(budget.percent, 100)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-medium text-gray-400 dark:text-gray-500">
                        <span>Limite {hideBalance ? "••••" : formatCurrency(safeNumber(budget.amount))}</span>
                        <span>{budget.percent.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )
      case 'accounts':
        return (
          <div key="accounts" className="mb-5">
            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/accounts")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Contas
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="px-2 pb-2">
                {accounts.length === 0 ? (
                  <div className="p-4 text-center text-[13px] font-medium text-gray-400 dark:text-gray-500">
                    Nenhuma conta registrada.
                  </div>
                ) : (
                  accounts.map((acc: any) => (
                    <div
                      key={acc.id}
                      onClick={() => goToAccount(acc.id)}
                      className="flex items-center justify-between gap-3 rounded-[18px] p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <BankLogo color={acc.color} name={acc.name} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                            {acc.name}
                          </p>
                          <p className="mt-0.5 text-[12px] font-medium text-gray-400 dark:text-gray-500">
                            Saldo previsto
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className={`text-[15px] ${getBalanceStyle(safeNumber(acc.balance))}`}>
                          {hideBalance ? "••••" : formatCurrency(safeNumber(acc.balance))}
                        </p>
                        <p
                          className={`mt-0.5 text-[12px] font-semibold ${
                            safeNumber(acc.previsto) >= 0 ? "text-gray-400 dark:text-gray-500" : "text-red-400"
                          }`}
                        >
                          {hideBalance ? "••••" : formatCurrency(safeNumber(acc.previsto))}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )
      case 'cards':
        return (
          <div key="cards" className="mb-5">
            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/cards")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Cartões de Crédito
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="px-2 pb-2">
                {cards.length === 0 ? (
                  <button
                    onClick={() => router.push("/cards/new")}
                    className="w-full rounded-[18px] p-4 flex items-center justify-center gap-2 text-sm font-semibold text-teal-600 transition-colors hover:bg-teal-50 dark:hover:bg-teal-900/10 active:scale-[0.98]"
                  >
                    <Plus size={18} />
                    Adicionar cartão
                  </button>
                ) : (
                  cards.map((card: any) => (
                    <div
                      key={card.id}
                      onClick={() => goToCard(card.id)}
                      className="flex items-center justify-between gap-3 rounded-[18px] p-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:scale-[0.98]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-11 w-11 items-center justify-center rounded-[16px] text-white shadow-sm shrink-0"
                          style={{ backgroundColor: card.color || "#f97316" }}
                        >
                          <CreditCard size={18} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                            {card.name}
                          </p>
                          <p className="mt-0.5 text-[12px] font-medium text-gray-400 dark:text-gray-500">
                            Fatura atual
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`text-[15px] font-bold ${
                            safeNumber(card.faturaAtual) > 0 ? "text-orange-500" : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {hideBalance ? "••••" : formatCurrency(safeNumber(card.faturaAtual))}
                        </p>
                        <p className="mt-0.5 text-[12px] font-medium text-gray-400 dark:text-gray-500">
                          Vence dia {card.due_day}
                        </p>
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
          <div key="recent" className="mb-5">
            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/transactions")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Transações Recentes
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="px-2 pb-2">
                {recentTransactions.length === 0 ? (
                  <div className="p-4 text-center text-[13px] font-medium text-gray-400 dark:text-gray-500">
                    Nenhuma transação registrada.
                  </div>
                ) : (
                  recentTransactions.map((tx: any, index: number) => {
                    const isPending = tx.status === "pending";
                    const IconComp = tx.type === "transfer" ? ArrowRightLeft : getDynamicIcon(tx.categories?.icon);

                    const attachmentIcon = getAttachmentIcon(tx.receipt_url);
                    const isIncome = tx.type === "income";
                    const isExpense = tx.type === "expense" || tx.type === "sangria";
                    const isTransfer = tx.type === "transfer";

                    let amountColorClass = "text-gray-800 dark:text-gray-200";
                    let amountPrefix = "";
                    let defaultName = "Transação";

                    if (isIncome) {
                      amountColorClass = "text-emerald-600 dark:text-emerald-400";
                      amountPrefix = "+";
                      defaultName = "Receita";
                    } else if (isExpense) {
                      amountColorClass = "text-red-500 dark:text-red-400";
                      amountPrefix = "-";
                      defaultName = "Despesa";
                    } else if (isTransfer) {
                      amountColorClass = "text-blue-500 dark:text-blue-400";
                      amountPrefix = tx.description?.toLowerCase().includes("de") ? "+" : "-";
                      defaultName = "Transferência";
                    }

                    return (
                      <div
                        key={tx.id}
                        onClick={() => goToTransaction(tx.id)}
                        className={`flex items-center justify-between gap-3 rounded-[18px] p-3 cursor-pointer transition-colors active:scale-[0.98] hover:bg-gray-50 dark:hover:bg-slate-700/50 ${
                          isPending ? "bg-amber-50 dark:bg-amber-900/10" : ""
                        } ${
                          index !== recentTransactions.length - 1 ? "border-b border-gray-100 dark:border-slate-700/70" : ""
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="shrink-0">
                            {isPending ? (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-500/10">
                                <Clock size={12} className="text-orange-500" />
                              </div>
                            ) : (
                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                                <Check size={12} className="text-emerald-500" />
                              </div>
                            )}
                          </div>

                          <div className="flex h-10 w-10 items-center justify-center rounded-[14px] shrink-0"
                            style={{
                              backgroundColor: tx.categories?.color ? `${tx.categories.color}15` : "#94a3b815",
                              color: tx.categories?.color || "#64748b",
                            }}
                          >
                            <IconComp size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                                {tx.description || tx.categories?.name || defaultName}
                              </p>
                              {attachmentIcon && <span className="shrink-0">{attachmentIcon}</span>}
                            </div>

                            <p className="mt-0.5 truncate text-[12px] font-medium text-gray-400 dark:text-gray-500">
                              {safeFormatDate(tx.date, "dd 'de' MMM")} •{" "}
                              {tx.categories?.name || "Geral"}
                            </p>
                          </div>
                        </div>

                        <p className={`shrink-0 whitespace-nowrap text-[15px] font-bold ${amountColorClass}`}>
                          {amountPrefix} {hideBalance ? "••••" : formatCurrency(safeNumber(tx.amount))}
                        </p>
                      </div>
                    );
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

  // ========== RENDERIZAÇÃO PRINCIPAL ==========
  if (isInitialLoad || (isDataLoading && !localTransactions.length && !localAccountsData.length)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 pt-6">
        <Skeleton count={1} className="h-10 w-full mb-6 rounded-2xl" />
        <Skeleton count={1} className="h-32 w-full rounded-[32px] mb-6" />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Skeleton count={1} className="h-24 w-full rounded-[28px]" />
          <Skeleton count={1} className="h-24 w-full rounded-[28px]" />
        </div>
        <Skeleton count={1} className="h-48 w-full rounded-[28px]" />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 font-sans relative px-4 pt-4 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-2.5 h-2.5 bg-teal-500 rounded-full animate-pulse shadow-md shadow-teal-500/40" />
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

      {cards.length > 0 && (
        <div className="mb-4 space-y-2">
          {cards.map((card: any) => (
            <InvoiceAlert key={card.id} dueDay={card.due_day} closingDay={card.closing_day} cardName={card.name} />
          ))}
        </div>
      )}

      {debtsList
        .filter((d: any) => {
          const due = safeDate(d.due_date)
          return due && differenceInDays(today, due) >= 0 && d.status !== 'paid'
        })
        .map((debt: any) => (
          <DebtAlert
            key={debt.id}
            personName={debt.person_name}
            amount={safeNumber(debt.total_amount) - (debt.paid_amount || 0)}
            dueDate={debt.due_date}
            debtId={debt.id}
          />
        ))}

      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            {greeting.icon}
            <p className="text-sm font-semibold truncate">
              {greeting.text}, <span className="text-gray-900 dark:text-gray-100">{firstName}</span>
            </p>
          </div>
          <ContextToggle />
        </div>
        
        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <div className="flex items-center gap-2">
            {isClient ? (
              <SyncButton
                pendingCount={typeof pendingCount === 'number' ? pendingCount : 0}
                isSyncing={!!isSyncing}
                isOnline={!!isOnline}
                onSync={forceSync}
                onClick={() => setIsSyncModalOpen(true)}
              />
            ) : (
              <div className="w-10 h-10 animate-pulse bg-gray-200 dark:bg-slate-700 rounded-full" />
            )}

            {notificationsEnabled && (
              <NotificationBell count={unreadNotifications} hasCritical={criticalCount > 0} onClick={() => setShowNotifications(true)} />
            )}
          </div>
          
          <div className="flex items-center gap-1.5 rounded-full border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 px-1.5 py-1 shadow-sm backdrop-blur-sm">
            <button onClick={() => { setCurrentDate(subMonths(currentDate, 1)); vibrate(10) }} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-slate-700 dark:hover:text-gray-200 active:scale-95"><ChevronLeft size={14} /></button>
            <span className="min-w-[82px] text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-700 dark:text-gray-200">{monthLabel}</span>
            <button onClick={() => { setCurrentDate(addMonths(currentDate, 1)); vibrate(10) }} className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-slate-700 dark:hover:text-gray-200 active:scale-95"><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {enabledSections.map(sectionId => renderSection(sectionId))}

      <button
        onClick={openPersonalize}
        className="w-full mt-2 flex items-center justify-center gap-2 py-4 rounded-[24px] bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-700 border border-teal-100 dark:border-slate-700 shadow-sm transition-all active:scale-[0.98]"
      >
        <Settings2 size={20} />
        <span className="font-semibold text-[15px]">Personalizar Dashboard</span>
      </button>

      <FAB onSave={() => reloadTxs()} />
      
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

      {isClient && (
        <SyncStatusModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
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