'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  Eye, EyeOff, ChevronRight, ChevronLeft, ArrowDown, ArrowUp,
  Loader2, Plus, Clock, Check, CreditCard, Wallet, Settings2,
  PieChart, AlertTriangle, Image, Paperclip, TrendingUp, TrendingDown,
  Sun, Moon, Sunrise, Sunset, RefreshCw
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
import ProjectionSparklineCard from '@/components/ProjectionSparklineCard'

// ============================================================
// SEÇÕES DISPONÍVEIS (para personalização)
// ============================================================
const ALL_SECTIONS = [
  { id: 'balance', label: 'Saldo Total' },
  { id: 'income-expense', label: 'Receitas / Despesas' },
  { id: 'projection', label: 'Projeção de Saldo' },
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

// ============================================================
// SAUDAÇÃO DINÂMICA
// ============================================================
function getGreeting(): { text: string; icon: React.ReactNode } {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return { text: 'Bom dia', icon: <Sunrise size={18} className="text-amber-500 shrink-0" /> }
  if (hour >= 12 && hour < 18) return { text: 'Boa tarde', icon: <Sun size={18} className="text-amber-500 shrink-0" /> }
  if (hour >= 18 && hour < 22) return { text: 'Boa noite', icon: <Sunset size={18} className="text-indigo-400 shrink-0" /> }
  return { text: 'Boa noite', icon: <Moon size={18} className="text-indigo-400 shrink-0" /> }
}

// ============================================================
// SKELETON LOADER DA HOME
// ============================================================
const HomeSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="bg-white dark:bg-slate-800 rounded-[32px] p-8 shadow-sm border border-gray-100 dark:border-slate-700/50">
      <div className="flex flex-col items-center gap-3">
        <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded-full" />
        <div className="h-9 w-48 bg-gray-200 dark:bg-slate-700 rounded-full" />
        <div className="h-5 w-32 bg-gray-100 dark:bg-slate-700/50 rounded-full mt-1" />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700" />
        <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
    </div>

    <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
      <div className="flex justify-between items-center px-5 py-4">
        <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="h-4 w-16 bg-gray-100 dark:bg-slate-700/50 rounded" />
      </div>
      <div className="px-2 pb-2 space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700" />
            <div className="w-10 h-10 rounded-[14px] bg-gray-100 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 bg-gray-100 dark:bg-slate-700 rounded" />
              <div className="h-2.5 w-1/2 bg-gray-100 dark:bg-slate-700 rounded" />
            </div>
            <div className="h-4 w-16 bg-gray-100 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
)

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
function HomeContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)

  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [previousBalance, setPreviousBalance] = useState(0)
  const [balanceVariation, setBalanceVariation] = useState(0)
  const [pendings, setPendings] = useState({ toPay: 0, toReceive: 0, faturas: 0 })
  const [accounts, setAccounts] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [debts, setDebts] = useState<any[]>([])
  const [financings, setFinancings] = useState<any[]>([])
  const [totalToReceive, setTotalToReceive] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [criticalCount, setCriticalCount] = useState(0)

  const [enabledSections, setEnabledSections] = useState<string[]>(DEFAULT_SECTION_ORDER)
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false)
  const [personalizeOrder, setPersonalizeOrder] = useState<typeof ALL_SECTIONS>(ALL_SECTIONS)
  const [personalizeEnabled, setPersonalizeEnabled] = useState<Set<string>>(new Set(DEFAULT_SECTION_ORDER))

  const { isOnline, pendingCount, isSyncing, syncQueue } = useOfflineQueue()

  const monthLabel = format(currentDate, 'MMMM', { locale: ptBR })
  const greeting = getGreeting()

  // Extrai o primeiro nome para a saudação
  const fullName = user?.user_metadata?.name || 'Álefe'
  const firstName = fullName.split(' ')[0]

  // Pull to refresh
  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || dataLoading) return
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
  }, [dataLoading, refreshing])

  const getBalanceStyle = (val: number) => {
    if (val > 0) return 'text-emerald-600 font-bold'
    if (val < 0) return 'text-red-500 font-bold'
    return 'text-gray-800 dark:text-gray-200 font-bold'
  }

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  useEffect(() => {
    const saved = localStorage.getItem('dfl_notifications_enabled')
    setNotificationsEnabled(saved !== 'false')
  }, [])

  useEffect(() => {
    if (!user) return
    loadLayout()
  }, [user, context])

  const loadLayout = async () => {
    if (!user) return
    const { data } = await supabase
      .from('home_layout')
      .select('section_order')
      .match({ user_id: user.id, context })
      .single()

    if (data?.section_order) {
      setEnabledSections(data.section_order)
      setPersonalizeOrder(ALL_SECTIONS.filter(s => data.section_order.includes(s.id)))
      setPersonalizeEnabled(new Set(data.section_order))
    }
    setLayoutLoaded(true)
  }

  const saveLayout = async (order: string[]) => {
    if (!user) return
    setEnabledSections(order)
    await supabase
      .from('home_layout')
      .upsert({
        user_id: user.id,
        context,
        section_order: order
      }, { onConflict: 'user_id,context' })
  }

  const toggleSection = (id: string) => {
    setPersonalizeEnabled(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const moveSection = (id: string, direction: 'up' | 'down') => {
    setPersonalizeOrder((prev) => {
      const currentIndex = prev.findIndex((item) => item.id === id)
      if (currentIndex === -1) return prev
      const newOrder = [...prev]
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (targetIndex >= 0 && targetIndex < newOrder.length) {
        [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]]
      }
      return newOrder
    })
  }

  const handleSavePersonalize = () => {
    const finalOrder = personalizeOrder
      .filter(s => personalizeEnabled.has(s.id))
      .map(s => s.id)
    saveLayout(finalOrder)
    setShowPersonalizeModal(false)
    showToast('Tela inicial personalizada!', 'success')
  }

  const openPersonalize = () => {
    const enabledOrder = enabledSections
      .map(id => ALL_SECTIONS.find(s => s.id === id))
      .filter(Boolean) as typeof ALL_SECTIONS
    const missing = ALL_SECTIONS.filter(s => !enabledSections.includes(s.id))
    setPersonalizeOrder([...enabledOrder, ...missing])
    setPersonalizeEnabled(new Set(enabledSections))
    setShowPersonalizeModal(true)
  }

  const loadData = useCallback(async () => {
    if (!user) return
    setDataLoading(true)

    try {
      const start = getLocalDateString(startOfMonth(currentDate))
      const end = getLocalDateString(endOfMonth(currentDate))

      const prevMonthDate = subMonths(currentDate, 1)
      const prevStart = getLocalDateString(startOfMonth(prevMonthDate))
      const prevEnd = getLocalDateString(endOfMonth(prevMonthDate))

      const [{ data: transactions }, { data: prevTransactions }, { data: subsData }, { data: debtsData }, { data: financingsData }, { data: budgetsData }, { data: creditCards }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, categories(name, icon, color)')
          .match({ user_id: user.id, context: context })
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false }),
        supabase
          .from('transactions')
          .select('amount, type')
          .match({ user_id: user.id, context: context, status: 'done' })
          .gte('date', prevStart)
          .lte('date', prevEnd),
        supabase
          .from('subscriptions')
          .select('*, categories(name, icon, color), accounts(name)')
          .match({ user_id: user.id, context: context, status: 'active' })
          .order('due_day', { ascending: true }),
        supabase
          .from('debts')
          .select('*')
          .match({ user_id: user.id, context: context })
          .in('status', ['pending', 'partial'])
          .order('due_date', { ascending: true }),
        supabase
          .from('financings')
          .select('*')
          .match({ user_id: user.id, context: context, status: 'active' })
          .order('next_due_date', { ascending: true }),
        supabase
          .from('budgets')
          .select('*, categories(name, icon, color)')
          .match({ user_id: user.id, context: context }),
        supabase
          .from('credit_cards')
          .select('*')
          .match({ user_id: user.id, context: context, is_archived: false })
          .order('created_at', { ascending: false })
      ])

      const txs = Array.isArray(transactions) ? transactions : []
      setSubscriptions(Array.isArray(subsData) ? subsData : [])
      setFinancings(Array.isArray(financingsData) ? financingsData : [])

      // Dívidas com progresso
      const debtsArray = Array.isArray(debtsData) ? debtsData : []
      const debtsWithProgress = await Promise.all(debtsArray.map(async (debt) => {
        const { data: payments } = await supabase
          .from('transactions')
          .select('amount')
          .eq('debt_id', debt.id)
          .eq('type', 'income')
        const paidAmount = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        const percent = Number(debt.total_amount) > 0 ? (paidAmount / Number(debt.total_amount)) * 100 : 0
        return { ...debt, paid_amount: paidAmount, percent: Math.min(percent, 100) }
      }))
      setDebts(debtsWithProgress)
      setTotalToReceive(debtsWithProgress.reduce((a, d) => a + (Number(d.total_amount) - (d.paid_amount || 0)), 0))

      // Resumo financeiro
      const income = txs.filter((t) => t.type === 'income' && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const expense = txs.filter((t) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const balance = income - expense

      const prevTxs = Array.isArray(prevTransactions) ? prevTransactions : []
      const prevInc = prevTxs.filter((t: any) => t.type === 'income').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      const prevExp = prevTxs.filter((t: any) => t.type === 'expense' || t.type === 'sangria').reduce((a: number, t: any) => a + Number(t.amount || 0), 0)
      const prevBal = prevInc - prevExp
      setPreviousBalance(prevBal)
      if (prevBal !== 0) {
        setBalanceVariation(((balance - prevBal) / Math.abs(prevBal)) * 100)
      } else {
        setBalanceVariation(balance > 0 ? 100 : balance < 0 ? -100 : 0)
      }

      const toPay = txs.filter((t) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'pending' && !t.credit_card_id).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const toReceive = txs.filter((t) => t.type === 'income' && t.status === 'pending').reduce((a, t) => a + (Number(t.amount) || 0), 0)

      setSummary({ income, expense, balance })
      setRecentTransactions(txs.slice(0, 5))

      // Contas
      const { data: accsData } = await supabase.from('accounts').select('*').match({ user_id: user.id, context: context }).order('name')
      const accsWithPrevisto = (Array.isArray(accsData) ? accsData : []).map((acc) => {
        const accTxs = txs.filter((t) => t.account_id === acc.id && t.status === 'pending')
        const pendingIncome = accTxs.filter((t) => t.type === 'income').reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const pendingExpense = accTxs.filter((t) => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const previsto = (Number(acc.balance) || 0) + pendingIncome - pendingExpense
        return { ...acc, previsto }
      })
      setAccounts(accsWithPrevisto)

      // Cartões de crédito
      const cardsArray = Array.isArray(creditCards) ? creditCards : []
      const cardsWithInvoice = cardsArray.map((card) => {
        const cardTxs = txs.filter((t) => t.credit_card_id === card.id)
        const faturaAtual = cardTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
        return { ...card, faturaAtual }
      })
      setCards(cardsWithInvoice)
      setPendings({ toPay, toReceive, faturas: cardsWithInvoice.reduce((acc, c) => acc + c.faturaAtual, 0) })

      // Orçamentos
      const budgetsArray = Array.isArray(budgetsData) ? budgetsData : []
      const budgetsWithSpent = budgetsArray.map((budget) => {
        const spent = txs.filter((t) => t.category_id === budget.category_id && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const remaining = Number(budget.amount) - spent
        const percent = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0
        return { ...budget, spent, remaining, percent: Math.min(percent, 100) }
      })
      setBudgets(budgetsWithSpent.sort((a, b) => b.percent - a.percent).slice(0, 3))

      // ============================================================
      // GERAÇÃO DE NOTIFICAÇÕES (COMPLETA, IGUAL À CENTRAL)
      // ============================================================
      const today = new Date()
      const todayDay = today.getDate()

      const { data: reads } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
      const readSet = new Set(reads?.map(r => r.notification_id) || [])

      const notifs: any[] = []

      // Cartões de crédito
      cardsWithInvoice.forEach(card => {
        const days = (card.due_day || 1) - todayDay
        if (days < 0) {
          notifs.push({ id: `invoice-overdue-${card.id}`, type: 'invoice_overdue', title: `Fatura vencida: ${card.name}`, subtitle: `Venceu dia ${card.due_day}`, cardId: card.id, severity: 'critical', isRead: readSet.has(`invoice-overdue-${card.id}`) })
        } else if (days <= 3) {
          notifs.push({ id: `invoice-soon-${card.id}`, type: 'invoice_soon', title: `Fatura próxima: ${card.name}`, subtitle: `Vence em ${days} dia(s)`, cardId: card.id, severity: 'warning', isRead: readSet.has(`invoice-soon-${card.id}`) })
        }
      })

      // Assinaturas
      const subs = Array.isArray(subsData) ? subsData : []
      subs.forEach((sub: any) => {
        const days = (sub.due_day || 1) - todayDay
        if (days < 0) {
          notifs.push({ id: `sub-overdue-${sub.id}`, type: 'subscription_overdue', title: `Assinatura vencida: ${sub.name}`, subtitle: `Venceu dia ${sub.due_day}`, subId: sub.id, severity: 'critical', isRead: readSet.has(`sub-overdue-${sub.id}`) })
        } else if (days <= 5) {
          notifs.push({ id: `sub-soon-${sub.id}`, type: 'subscription_soon', title: `Assinatura próxima: ${sub.name}`, subtitle: `Vence em ${days} dia(s)`, subId: sub.id, severity: 'warning', isRead: readSet.has(`sub-soon-${sub.id}`) })
        }
      })

      // Financiamentos
      const fins = Array.isArray(financingsData) ? financingsData : []
      fins.forEach((fin: any) => {
        if (!fin.next_due_date) return
        const daysUntilDue = differenceInDays(new Date(fin.next_due_date), today)
        if (daysUntilDue < 0) {
          notifs.push({ id: `financing-overdue-${fin.id}`, type: 'financing_overdue', title: `Parcela vencida: ${fin.name}`, subtitle: `Venceu ${format(new Date(fin.next_due_date), "dd/MM")}`, financingId: fin.id, severity: 'critical', isRead: readSet.has(`financing-overdue-${fin.id}`) })
        } else if (daysUntilDue <= 3) {
          notifs.push({ id: `financing-soon-${fin.id}`, type: 'financing_soon', title: `Parcela próxima: ${fin.name}`, subtitle: `Vence em ${daysUntilDue} dia(s)`, financingId: fin.id, severity: 'warning', isRead: readSet.has(`financing-soon-${fin.id}`) })
        }
      })

      // Dívidas
      debtsWithProgress.forEach((debt: any) => {
        if (!debt.due_date) return
        const daysUntilDue = differenceInDays(new Date(debt.due_date), today)
        const remaining = Number(debt.total_amount) - (debt.paid_amount || 0)
        if (daysUntilDue < 0) {
          notifs.push({ id: `debt-overdue-${debt.id}`, type: 'debt_overdue', title: `Dívida vencida: ${debt.person_name}`, subtitle: `Venceu ${format(new Date(debt.due_date), "dd/MM")} — R$ ${remaining.toFixed(2)}`, debtId: debt.id, severity: 'critical', isRead: readSet.has(`debt-overdue-${debt.id}`) })
        } else if (daysUntilDue <= 3) {
          notifs.push({ id: `debt-soon-${debt.id}`, type: 'debt_soon', title: `Dívida próxima: ${debt.person_name}`, subtitle: `Vence em ${daysUntilDue} dia(s) — R$ ${remaining.toFixed(2)}`, debtId: debt.id, severity: 'warning', isRead: readSet.has(`debt-soon-${debt.id}`) })
        }
      })

      // Orçamentos
      budgetsWithSpent.forEach((budget: any) => {
        const spent = budget.spent
        const remaining = budget.remaining
        if (remaining < 0) {
          notifs.push({ id: `budget-over-${budget.id}`, type: 'budget_over', title: `Orçamento estourado: ${budget.name || budget.categories?.name}`, subtitle: `Gasto R$ ${spent.toFixed(2)} de R$ ${Number(budget.amount).toFixed(2)}`, budgetId: budget.id, severity: 'critical', isRead: readSet.has(`budget-over-${budget.id}`) })
        } else if (Number(budget.amount) > 0 && (spent / Number(budget.amount)) * 100 >= 80) {
          notifs.push({ id: `budget-warn-${budget.id}`, type: 'budget_warning', title: `Orçamento quase lá: ${budget.name || budget.categories?.name}`, subtitle: `${((spent / Number(budget.amount)) * 100).toFixed(0)}% utilizado`, budgetId: budget.id, severity: 'warning', isRead: readSet.has(`budget-warn-${budget.id}`) })
        }
      })

      // Pendências gerais
      const pendingExpenses = txs.filter(t => t.status === 'pending' && (t.type === 'expense' || t.type === 'sangria'))
      if (pendingExpenses.length > 0) {
        notifs.push({ id: 'pending-expenses', type: 'pending_expense', title: `${pendingExpenses.length} despesa(s) pendente(s)`, subtitle: `Total: R$ ${pendingExpenses.reduce((a, t) => a + (Number(t.amount) || 0), 0).toFixed(2)}`, route: '/transactions?filter=expense&status=pending', severity: 'info', isRead: readSet.has('pending-expenses') })
      }

      const pendingIncomes = txs.filter(t => t.status === 'pending' && t.type === 'income')
      if (pendingIncomes.length > 0) {
        notifs.push({ id: 'pending-incomes', type: 'pending_income', title: `${pendingIncomes.length} receita(s) a receber`, subtitle: `Total: R$ ${pendingIncomes.reduce((a, t) => a + (Number(t.amount) || 0), 0).toFixed(2)}`, route: '/transactions?filter=income&status=pending', severity: 'success', isRead: readSet.has('pending-incomes') })
      }

      setNotifications(notifs)
      setUnreadNotifications(notifs.filter(n => !n.isRead).length)
      setCriticalCount(notifs.filter(n => n.severity === 'critical' && !n.isRead).length)

    } catch (err) {
      console.error('Erro na Home:', err)
    } finally {
      setDataLoading(false)
    }
  }, [context, currentDate, user])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { const h = () => loadData(); window.addEventListener('focus', h); return () => window.removeEventListener('focus', h) }, [loadData])
  useEffect(() => { const h = () => loadData(); window.addEventListener('queue-synced', h); return () => window.removeEventListener('queue-synced', h) }, [loadData])

  const formatCurrency = (val: number) => `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const totalAccountsBalance = accounts.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0)
  const today = new Date()
  const todayDay = today.getDate()
  const sortedByDue = [...cards].sort((a, b) => {
    const aDue = a.due_day < todayDay ? a.due_day + 31 : a.due_day
    const bDue = b.due_day < todayDay ? b.due_day + 31 : b.due_day
    return aDue - bDue
  })
  const nextCard = sortedByDue.length > 0 ? sortedByDue[0] : null
  const allCardsPaid = cards.length > 0 && cards.every((c) => (c.faturaAtual || 0) === 0)

  const getAttachmentIcon = (url: string | null) => {
    if (!url) return null
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url)
    if (isImage) return <Image size={12} className="text-blue-500 shrink-0" />
    return <Paperclip size={12} className="text-gray-500 shrink-0" />
  }

  if (authLoading || dataLoading || !layoutLoaded) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 font-sans px-4 pt-6 pb-28">
        <HomeSkeleton />
      </div>
    )
  }

  const renderSection = (sectionId: string) => {
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
          <div key="projection" className="mb-6">
            <ProjectionSparklineCard />
          </div>
        )
      case 'next-card':
        if (!nextCard && !allCardsPaid) return null
        return (
          <div key="next-card" className="mb-6">
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
        if (debts.length === 0) return null
        return (
          <div key="receivables" className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/debts')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">A Receber</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {debts.slice(0, 3).map(debt => {
                  const IconComp = getDynamicIcon(debt.icon || 'user')
                  const remaining = Number(debt.total_amount) - (debt.paid_amount || 0)
                  const daysUntilDue = debt.due_date ? differenceInDays(new Date(debt.due_date), today) : null
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
                  const percent = Math.min(debt.percent, 100)
                  return (
                    <div
                      key={debt.id}
                      onClick={() => router.push(`/debts/${debt.id}`)}
                      className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors"
                    >
                      <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${debt.color}15`, color: debt.color }}>
                        <IconComp size={20} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100 truncate">{debt.person_name}</p>
                          <p className="text-[15px] font-bold text-emerald-600 ml-2 shrink-0">{formatCurrency(remaining)}</p>
                        </div>

                        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mb-1">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              isOverdue ? 'bg-red-500' : remaining <= 0 ? 'bg-emerald-500' : 'bg-teal-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center">
                          <span className={`text-[11px] font-medium ${
                            isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'
                          }`}>
                            {isOverdue
                              ? `Atrasado ${Math.abs(daysUntilDue)} dia(s)`
                              : debt.due_date
                                ? `Vence ${format(new Date(debt.due_date), "dd/MM")}`
                                : 'Sem prazo'}
                          </span>
                          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
                            {percent.toFixed(0)}% pago
                          </span>
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
          <div key="financings" className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/financings')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Financiamentos</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {financings.slice(0, 3).map(fin => {
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
          <div key="budgets" className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/budgets')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Orçamentos Ativos</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {budgets.map(budget => {
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
                    {accounts.map(acc => (
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
                  cards.map(card => (
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
                  recentTransactions.map((tx, index) => {
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

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-28 font-sans relative px-4 pt-6 transition-colors duration-300">
      {/* Pull to refresh indicator */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      <NetworkStatus isOnline={isOnline} pendingCount={pendingCount} isSyncing={isSyncing} />

      {cards.length > 0 && (
        <div className="mb-4 space-y-2">
          {cards.map(card => (
            <InvoiceAlert key={card.id} dueDay={card.due_day} closingDay={card.closing_day} cardName={card.name} />
          ))}
        </div>
      )}

      {debts.filter(d => d.due_date && differenceInDays(new Date(), new Date(d.due_date)) > 0 && d.status !== 'paid').length > 0 && (
        <div className="mb-4 space-y-2">
          {debts.filter(d => d.due_date && differenceInDays(new Date(), new Date(d.due_date)) > 0 && d.status !== 'paid').map(debt => (
            <DebtAlert key={debt.id} personName={debt.person_name} amount={Number(debt.total_amount) - (debt.paid_amount || 0)} dueDate={debt.due_date} debtId={debt.id} />
          ))}
        </div>
      )}

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

      <FAB onSave={() => loadData()} />
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
          notifications={notifications}
          onReadChange={(unread) => setUnreadNotifications(unread)}
        />
      )}
    </div>
  )
}

export default function HomePage() {
  return (
    <ContextProvider>
      <HomeContent />
    </ContextProvider>
  )
}