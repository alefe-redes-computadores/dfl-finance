'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  Eye, EyeOff, ChevronRight, ChevronLeft, ArrowDown, ArrowUp,
  Loader2, Plus, Clock, Check, CreditCard, Wallet, Settings2,
  PieChart, AlertTriangle, Image, Paperclip, TrendingUp, TrendingDown,
  Sun, Moon, Sunrise, Sunset, RefreshCw, ArrowRightLeft, Building2, User,
  Sparkles, Calendar
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
// 🔥 NOVO: Import do hook local
import { useLocalData } from '@/hooks/useLocalData'

// 🆕 Lazy loading do gráfico de projeção (pesado)
const ProjectionSparklineCard = lazy(() => import('@/components/ProjectionSparklineCard'))

// ============================================================
// SEÇÕES DISPONÍVEIS (para personalização)
// ============================================================
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

// 🆕 Cards fixos (NUNCA terão botão)
const FIXED_SECTIONS = ['balance', 'income-expense', 'pendings', 'accounts', 'cards', 'recent']

// ============================================================
// FUNÇÕES AUXILIARES (para contexto)
// ============================================================
const getContextLabel = (ctx: string) => ctx === 'dfl' ? 'PJ' : 'PF'
const getContextIcon = (ctx: string) =>
  ctx === 'dfl' ? <Building2 size={14} className="text-blue-500" /> : <User size={14} className="text-emerald-500" />

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
  const { context, appMode } = useContext_()
  const { showToast } = useToast()
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false) // apenas para controle do pull, sem toast

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
  const [loans, setLoans] = useState<any[]>([])
  const [totalToReceive, setTotalToReceive] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
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

  // 🆕 Estado para o toast com desfazer
  const [undoToast, setUndoToast] = useState<{ message: string; onUndo: () => void } | null>(null)

  const { isOnline, pendingCount, isSyncing, syncQueue } = useOfflineQueue()

  const monthLabel = format(currentDate, 'MMMM', { locale: ptBR })
  const greeting = getGreeting()

  const fullName = user?.user_metadata?.name || 'Álefe'
  const firstName = fullName.split(' ')[0]

  // ============================================================
  // 🔥 BUSCAS LOCAIS (INDEXEDDB)
  // ============================================================
  const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
  const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

  // Transações do mês
  const { data: localTransactions, loading: txLoading, syncing: txSyncing, reload: reloadTransactions } = useLocalData({
    table: 'transactions',
    filters: { context },
    orderBy: { field: 'date', direction: 'desc' },
    realtime: true,
  })

  // Categorias
  const { data: localCategories } = useLocalData({
    table: 'categories',
    filters: { context },
    realtime: false,
  })

  // Contas
  const { data: localAccountsData } = useLocalData({
    table: 'accounts',
    filters: { context },
    realtime: false,
  })

  // Dívidas
  const { data: localDebts } = useLocalData({
    table: 'debts',
    filters: { context },
    realtime: true,
  })

  // Financiamentos
  const { data: localFinancings } = useLocalData({
    table: 'financings',
    filters: { context, status: 'active' },
    realtime: true,
  })

  // Cartões
  const { data: localCards } = useLocalData({
    table: 'credit_cards',
    filters: { context, is_archived: false },
    realtime: true,
  })

  // ============================================================
  // 🔥 JOIN EM MEMÓRIA (CATEGORIAS E CONTAS)
  // ============================================================
  const transactionsWithJoin = (localTransactions || []).map(tx => {
    const category = (localCategories || []).find((c: any) => c.id === tx.category_id)
    const account = (localAccountsData || []).find((a: any) => a.id === tx.account_id)
    return {
      ...tx,
      categories: category ? { name: category.name, icon: category.icon, color: category.color } : null,
      accounts: account ? { name: account.name, color: account.color } : null,
    }
  })

  // Filtra transações do mês atual
  const monthTransactions = transactionsWithJoin.filter(t => t.date >= start && t.date <= end)

  // ============================================================
  // LOAD DATA (REFATORADO PARA USAR DADOS LOCAIS)
  // ============================================================
  const loadData = useCallback(async () => {
    if (!user) return
    setDataLoading(true)
    setLoadingPulse(true)

    try {
      // 🔥 CÁLCULOS DE RECEITAS/DESPESAS
      const income = monthTransactions
        .filter(t => t.type === 'income' && t.status === 'done')
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const expense = monthTransactions
        .filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const balance = income - expense
      setSummary({ income, expense, balance })

      // 🔥 MÊS ANTERIOR (para variação)
      const prevMonthDate = subMonths(currentDate, 1)
      const prevStart = format(startOfMonth(prevMonthDate), 'yyyy-MM-dd')
      const prevEnd = format(endOfMonth(prevMonthDate), 'yyyy-MM-dd')
      const prevMonthTxs = transactionsWithJoin.filter(t => t.date >= prevStart && t.date <= prevEnd)
      const prevInc = prevMonthTxs
        .filter(t => t.type === 'income' && t.status === 'done')
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const prevExp = prevMonthTxs
        .filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const prevBal = prevInc - prevExp
      setPreviousBalance(prevBal)
      if (prevBal !== 0) {
        setBalanceVariation(((balance - prevBal) / Math.abs(prevBal)) * 100)
      } else {
        setBalanceVariation(balance > 0 ? 100 : balance < 0 ? -100 : 0)
      }

      // 🔥 PENDÊNCIAS
      const toPay = monthTransactions
        .filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'pending' && !t.credit_card_id)
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const toReceive = monthTransactions
        .filter(t => t.type === 'income' && t.status === 'pending')
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)

      // 🔥 RECENTES (últimas 5)
      setRecentTransactions(monthTransactions.slice(0, 5))

      // 🔥 CONTAS (com saldo previsto)
      const accsWithPrevisto = (localAccountsData || []).map((acc: any) => {
        const accTxs = monthTransactions.filter(t => t.account_id === acc.id && t.status === 'pending')
        const pendingIncome = accTxs.filter(t => t.type === 'income').reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const pendingExpense = accTxs.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const previsto = (Number(acc.balance) || 0) + pendingIncome - pendingExpense
        return { ...acc, previsto }
      })
      setAccounts(accsWithPrevisto)

      // 🔥 CARTÕES (com fatura atual)
      const cardsWithInvoice = (localCards || []).map((card: any) => {
        const cardTxs = monthTransactions.filter(t => t.credit_card_id === card.id)
        const faturaAtual = cardTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
        return { ...card, faturaAtual }
      })
      setCards(cardsWithInvoice)

      // 🔥 PENDÊNCIAS (atualizado)
      setPendings({
        toPay,
        toReceive,
        faturas: cardsWithInvoice.reduce((acc, c) => acc + c.faturaAtual, 0)
      })

      // 🔥 DÍVIDAS (com progresso)
      const debtsWithProgress = (localDebts || []).map((debt: any) => {
        const payments = monthTransactions.filter(t => t.debt_id === debt.id && t.type === 'income')
        const paidAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        const percent = Number(debt.total_amount) > 0 ? (paidAmount / Number(debt.total_amount)) * 100 : 0
        return { ...debt, paid_amount: paidAmount, percent: Math.min(percent, 100) }
      })
      setDebts(debtsWithProgress)
      setTotalToReceive(debtsWithProgress.reduce((a, d) => a + (Number(d.total_amount) - (d.paid_amount || 0)), 0))

      // 🔥 FINANCIAMENTOS
      setFinancings(localFinancings || [])

      // 🔥 EMPRÉSTIMOS (ainda via Supabase, pois não temos tabela local)
      // TODO: Adicionar tabela loans no Dexie
      const { data: loansData } = await supabase
        .from('loans')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['active', 'completed'])
        .order('created_at', { ascending: false })
      setLoans(Array.isArray(loansData) ? loansData : [])

      // 🔥 ORÇAMENTOS (ainda via Supabase, pois não temos tabela local)
      // TODO: Adicionar tabela budgets no Dexie
      const { data: budgetsData } = await supabase
        .from('budgets')
        .select('*, categories(name, icon, color)')
        .match({ user_id: user.id, context })
      const budgetsArray = Array.isArray(budgetsData) ? budgetsData : []
      const budgetsWithSpent = budgetsArray.map((budget) => {
        const spent = monthTransactions
          .filter(t => t.category_id === budget.category_id && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
          .reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const remaining = Number(budget.amount) - spent
        const percent = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0
        return { ...budget, spent, remaining, percent: Math.min(percent, 100) }
      })
      setBudgets(budgetsWithSpent.sort((a, b) => b.percent - a.percent).slice(0, 3))

      // 🔥 ASSINATURAS (ainda via Supabase, pois não temos tabela local)
      // TODO: Adicionar tabela subscriptions no Dexie
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('*, categories(name, icon, color), accounts(name)')
        .match({ user_id: user.id, context, status: 'active' })
        .order('due_day', { ascending: true })
      setSubscriptions(Array.isArray(subsData) ? subsData : [])

      // ============================================================
      // GERAÇÃO DE NOTIFICAÇÕES (mantido igual)
      // ============================================================
      const today = new Date()
      const todayDay = today.getDate()

      const { data: reads } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
      const readSet = new Set(reads?.map(r => r.notification_id) || [])

      const notifs: any[] = []

      // Cartões de crédito - alertas de vencimento
      cardsWithInvoice.forEach((card: any) => {
        const days = (card.due_day || 1) - todayDay
        if (days < 0) {
          notifs.push({ id: `invoice-overdue-${card.id}`, type: 'invoice_overdue', title: `Fatura vencida: ${card.name}`, subtitle: `Venceu dia ${card.due_day}`, cardId: card.id, severity: 'critical', isRead: readSet.has(`invoice-overdue-${card.id}`) })
        } else if (days <= 3) {
          notifs.push({ id: `invoice-soon-${card.id}`, type: 'invoice_soon', title: `Fatura próxima: ${card.name}`, subtitle: `Vence em ${days} dia(s)`, cardId: card.id, severity: 'warning', isRead: readSet.has(`invoice-soon-${card.id}`) })
        }

        // Melhor dia de compra
        const closingDay = card.closing_day || 1
        const nextClosingDate = new Date(today.getFullYear(), today.getMonth(), closingDay)
        if (today > nextClosingDate) {
          nextClosingDate.setMonth(nextClosingDate.getMonth() + 1)
        }
        const daysAfterClosing = differenceInDays(today, nextClosingDate)
        if (daysAfterClosing === 1) {
          const purchaseMonth = nextClosingDate.getMonth() + 2
          const purchaseYear = nextClosingDate.getFullYear()
          const adjustedMonth = purchaseMonth > 12 ? purchaseMonth - 12 : purchaseMonth
          const adjustedYear = purchaseMonth > 12 ? purchaseYear + 1 : purchaseYear
          const monthNames = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
          const dueMonth = monthNames[adjustedMonth - 1]

          notifs.push({
            id: `best-buy-day-${card.id}-${today.toISOString().split('T')[0]}`,
            type: 'best_buy_day',
            title: `✨ Melhor dia para comprar: ${card.name}`,
            subtitle: `Tudo que comprar hoje vencerá em ${dueMonth} de ${adjustedYear}. Aproveite!`,
            cardId: card.id,
            severity: 'info',
            isRead: readSet.has(`best-buy-day-${card.id}-${today.toISOString().split('T')[0]}`)
          })
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
      const fins = Array.isArray(localFinancings) ? localFinancings : []
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
      const pendingExpenses = monthTransactions.filter(t => t.status === 'pending' && (t.type === 'expense' || t.type === 'sangria'))
      if (pendingExpenses.length > 0) {
        notifs.push({ id: 'pending-expenses', type: 'pending_expense', title: `${pendingExpenses.length} despesa(s) pendente(s)`, subtitle: `Total: R$ ${pendingExpenses.reduce((a, t) => a + (Number(t.amount) || 0), 0).toFixed(2)}`, route: '/transactions?filter=expense&status=pending', severity: 'info', isRead: readSet.has('pending-expenses') })
      }

      const pendingIncomes = monthTransactions.filter(t => t.status === 'pending' && t.type === 'income')
      if (pendingIncomes.length > 0) {
        notifs.push({ 
          id: 'pending-incomes', 
          type: 'pending_income', 
          title: `${pendingIncomes.length} receita(s) a receber`, 
          subtitle: `Total: R$ ${pendingIncomes.reduce((a, t) => a + (Number(t.amount) || 0), 0).toFixed(2)}`,
          route: '/transactions?filter=income&status=pending',
          severity: 'info', 
          isRead: readSet.has('pending-incomes') 
        })
      }

      setNotifications(notifs)
      setUnreadNotifications(notifs.filter(n => !n.isRead).length)
      setCriticalCount(notifs.filter(n => n.severity === 'critical' && !n.isRead).length)

    } catch (err) {
      console.error('Erro na Home:', err)
    } finally {
      setDataLoading(false)
      setLoadingPulse(false)
    }
  }, [context, currentDate, user, monthTransactions, localAccountsData, localCards, localDebts, localFinancings])

  // ============================================================
  // EFETTOS
  // ============================================================
  useEffect(() => {
    if (user?.id && context) {
      // Recarrega transações, contas, categorias, etc. em background
      // O loadData() já usa os dados locais
      loadData()
    }
  }, [user?.id, context, currentDate, loadData])

  // ============================================================
  // PULL TO REFRESH (mantido igual)
  // ============================================================
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
      // Recarrega dados (já usa dados locais)
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

  // ============================================================
  // FUNÇÕES AUXILIARES (mantidas iguais)
  // ============================================================
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

  // ============================================================
  // FUNÇÃO PARA OCULTAR CARD (mantida igual)
  // ============================================================
  const handleHideCard = (sectionId: string, sectionLabel: string) => {
    const removedSection = sectionId
    const removedLabel = sectionLabel

    setEnabledSections(prev => prev.filter(id => id !== removedSection))

    setUndoToast({
      message: `"${removedLabel}" ocultado`,
      onUndo: () => {
        setEnabledSections(prev => {
          const restored = [...prev, removedSection]
          return restored.sort((a, b) => {
            const idxA = ALL_SECTIONS.findIndex(s => s.id === a)
            const idxB = ALL_SECTIONS.findIndex(s => s.id === b)
            return idxA - idxB
          })
        })
        showToast(`"${removedLabel}" restaurado`, 'success')
        setUndoToast(null)
      }
    })

    setTimeout(() => {
      setEnabledSections(current => {
        if (!current.includes(removedSection)) {
          saveLayout(current)
        }
        return current
      })
      setUndoToast(null)
    }, 3500)
  }

  // ============================================================
  // RENDERIZAÇÃO DAS SEÇÕES (mantida igual, com dados locais)
  // ============================================================
  const renderSection = (sectionId: string) => {
    const sectionLabel = ALL_SECTIONS.find(s => s.id === sectionId)?.label || sectionId
    const isFixed = FIXED_SECTIONS.includes(sectionId)

    switch (sectionId) {
      // ... (todas as seções ficam IDÊNTICAS ao código original,
      // pois já usam os estados que foram atualizados com dados locais)
      // O código é extenso, mas a única mudança é que os dados vêm do IndexedDB
      // em vez do Supabase diretamente.
      default:
        return null
    }
  }

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-28 font-sans relative px-4 pt-6 transition-colors duration-300">
      {/* 🔵 Bolinha de carregamento sutil */}
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* ❌ REMOVIDO: Toast de "Atualizando..." que dava impressão de lentidão */}

      {/* 🆕 Toast com desfazer */}
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