// src/app/(app)/home/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef, lazy, Suspense, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import ProjectionChart from '@/components/ProjectionChart'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  Eye, EyeOff, ChevronRight, ChevronLeft, ArrowDown, ArrowUp,
  Plus, Clock, Check, CreditCard, Wallet, Settings2,
  AlertTriangle, Image, Paperclip,
  Sun, Moon, Sunrise, Sunset, RefreshCw, ArrowRightLeft, Building2, User,
  SearchX,
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { useLocalSync } from '@/hooks/useLocalSync'
import NotificationBell from '@/components/NotificationBell'
import NotificationCenter from '@/components/NotificationCenter'
import SyncButton from '@/components/SyncButton'
import SyncStatusModal from '@/components/SyncStatusModal'
import BankLogo from '@/components/BankLogo'
import { useToast } from '@/contexts/ToastContext'
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
import EmptyState from '@/components/EmptyState'
import {
  getCardBillingCycleForMonth,
  isTransactionInCardCycle,
} from '@/lib/cardOperations'
import {
  getDebtDueState,
  getDebtRemainingAmount,
  getDebtStatusFromAmounts,
  getDueDateState,
  isDebtPayment,
} from '@/lib/debtOperations'
import {
  getPendingDirection,
  getPendingLabel,
  isStandalonePendingReceivable,
} from '@/lib/pendingOperations'

// ALL_SECTIONS COM DESCRIÇÕES PARA O PERSONALIZE MODAL
const ALL_SECTIONS = [
  { id: 'balance', label: 'Saldo Total', description: 'Visão consolidada do seu patrimônio' },
  { id: 'income-expense', label: 'Receitas e despesas', description: 'Entradas e saídas do mês' },
  { id: 'pendings', label: 'Pendências', description: 'Prioridades, contas e vencimentos' },
  { id: 'accounts', label: 'Contas', description: 'Suas contas bancárias' },
  { id: 'projection', label: 'Projeção de Saldo', description: 'Previsão para os próximos 30 dias' },
  { id: 'recent', label: 'Transações Recentes', description: 'Últimas movimentações' },
  { id: 'next-card', label: 'Próxima Fatura', description: 'Próximo vencimento do cartão' },
  { id: 'receivables', label: 'A Receber', description: 'Valores a receber de terceiros' },
  { id: 'financings', label: 'Financiamentos', description: 'Parcelas de financiamentos ativos' },
  { id: 'budgets', label: 'Orçamentos', description: 'Acompanhamento de orçamentos' },
  { id: 'cards', label: 'Cartões', description: 'Cartões de crédito' },
  { id: 'loans', label: 'Empréstimos entre Contextos', description: 'Transferências entre PF e PJ' },
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

  const monthLabel = format(currentDate, 'MMMM', { locale: ptBR })
  const greeting = getGreeting()
  const firstName = (user?.user_metadata?.name || 'Visitante').split(' ')[0]

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

  const { isOnline, pendingCount, isSyncing, forceSync } = useLocalSync()

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('dfl_notifications_enabled')
    setNotificationsEnabled(saved !== 'false')
  }, [])

  const { data: rawTransactions, loading: txLoading } = useLocalData({
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

  useEffect(() => {
    if (!isDataLoading && !syncAttempted) {
      const timer = setTimeout(() => {
        setIsInitialLoad(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isDataLoading, syncAttempted])

  useEffect(() => {
    setLoadingPulse(isDataLoading)
  }, [isDataLoading])

  useEffect(() => {
    if (!isDataLoading && (localTransactions.length || localAccountsData.length)) {
      setIsInitialLoad(false)
    }
  }, [isDataLoading, localTransactions, localAccountsData])

  const start = useMemo(() => format(startOfMonth(currentDate), 'yyyy-MM-dd'), [currentDate])
  const end = useMemo(() => format(endOfMonth(currentDate), 'yyyy-MM-dd'), [currentDate])
  const today = useMemo(() => new Date(), [])

  const getCardDueDate = (
    dueDay: number | null | undefined,
    year: number,
    month: number
  ) => {
    const normalizedDueDay = Math.max(
      1,
      Math.min(31, safeNumber(dueDay) || 1)
    )

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
    const clampedDay = Math.min(normalizedDueDay, lastDayOfMonth)

    return new Date(year, month, clampedDay, 12, 0, 0, 0)
  }

  const getNextCardDueDate = (
    dueDay: number | null | undefined,
    referenceDate: Date = new Date()
  ) => {
    const reference = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
      12,
      0,
      0,
      0
    )

    let dueDate = getCardDueDate(
      dueDay,
      reference.getFullYear(),
      reference.getMonth()
    )

    if (dueDate < reference) {
      const nextMonthReference = new Date(
        reference.getFullYear(),
        reference.getMonth() + 1,
        1,
        12,
        0,
        0,
        0
      )

      dueDate = getCardDueDate(
        dueDay,
        nextMonthReference.getFullYear(),
        nextMonthReference.getMonth()
      )
    }

    return dueDate
  }

  const getDaysUntilCardDue = (
    dueDay: number | null | undefined,
    referenceDate: Date = new Date()
  ) => {
    const reference = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate(),
      12,
      0,
      0,
      0
    )

    return differenceInDays(
      getNextCardDueDate(dueDay, reference),
      reference
    )
  }

  const categoryById = useMemo(
    () => new Map(localCategories.map((category: any) => [category.id, category])),
    [localCategories]
  )

  const accountById = useMemo(
    () => new Map(localAccountsData.map((account: any) => [account.id, account])),
    [localAccountsData]
  )

  const transactionsWithJoin = useMemo(() => {
    return localTransactions.map((tx: any) => {
      const category = categoryById.get(tx.category_id) as any
      const account = accountById.get(tx.account_id) as any

      return {
        ...tx,
        categories: category
          ? { name: category.name, icon: category.icon, color: category.color }
          : null,
        accounts: account
          ? { name: account.name, color: account.color }
          : null,
      }
    })
  }, [localTransactions, categoryById, accountById])

  const monthTransactions = useMemo(() =>
    transactionsWithJoin
      .filter((t: any) => t.date >= start && t.date <= end)
      .sort((a: any, b: any) => {
        const timeA = new Date(a.created_at || a.date || 0).getTime()
        const timeB = new Date(b.created_at || b.date || 0).getTime()
        return timeB - timeA
      }),
  [transactionsWithJoin, start, end])

  const summary = useMemo(() => {
    return monthTransactions.reduce(
      (acc: { income: number; expense: number; balance: number }, tx: any) => {
        if (tx.status !== 'done') return acc

        const amount = safeNumber(tx.amount)

        if (tx.type === 'income') acc.income += amount
        if (tx.type === 'expense' || tx.type === 'sangria') acc.expense += amount

        acc.balance = acc.income - acc.expense
        return acc
      },
      { income: 0, expense: 0, balance: 0 }
    )
  }, [monthTransactions])

  const recentTransactions = useMemo(() => monthTransactions.slice(0, 4), [monthTransactions])

  const pendingByAccount = useMemo(() => {
    const result = new Map<string, { income: number; expense: number }>()

    for (const tx of monthTransactions) {
      if (!tx.account_id || tx.status !== 'pending') continue

      const current = result.get(tx.account_id) || { income: 0, expense: 0 }
      const amount = safeNumber(tx.amount)

      if (tx.type === 'income') current.income += amount
      if (tx.type === 'expense' || tx.type === 'sangria') current.expense += amount

      result.set(tx.account_id, current)
    }

    return result
  }, [monthTransactions])

  const accounts = useMemo(() => {
    return localAccountsData.map((acc: any) => {
      const pending = pendingByAccount.get(acc.id) || { income: 0, expense: 0 }
      const previsto = safeNumber(acc.balance) + pending.income - pending.expense
      return { ...acc, previsto }
    })
  }, [localAccountsData, pendingByAccount])

  const cards = useMemo(() => {
    return localCards.map((card: any) => {
      const cycle = getCardBillingCycleForMonth(
        card,
        currentDate
      )

      const cardTxs = localTransactions.filter(
        (t: any) =>
          t.credit_card_id === card.id &&
          t.type === 'expense' &&
          t.affects_balance !== true &&
          isTransactionInCardCycle(
            card,
            t.date,
            cycle.closingDate
          )
      )

      const faturaAtual = cardTxs.reduce(
        (acc: number, t: any) =>
          acc + safeNumber(t.amount),
        0
      )

      return {
        ...card,
        faturaAtual,
        billingCycle: cycle,
      }
    })
  }, [localCards, localTransactions, currentDate])

  const debtPaymentsById = useMemo(() => {
    const result = new Map<string, number>()

    for (const tx of localTransactions) {
      if (!isDebtPayment(tx) || !tx.debt_id) continue

      result.set(
        tx.debt_id,
        (result.get(tx.debt_id) || 0) + Math.round(safeNumber(tx.amount) * 100)
      )
    }

    return result
  }, [localTransactions])

  const debtsList = useMemo(() => {
    return localDebts
      .map((debt: any) => {
        const totalAmountCents = Math.round(safeNumber(debt.total_amount) * 100)
        const paidAmountCents = debtPaymentsById.get(debt.id) || 0
        const status =
          debt.status === 'cancelled'
            ? 'cancelled'
            : getDebtStatusFromAmounts(totalAmountCents, paidAmountCents)
        const percent =
          totalAmountCents > 0
            ? (paidAmountCents / totalAmountCents) * 100
            : 0

        return {
          ...debt,
          paid_amount: paidAmountCents / 100,
          percent: Math.min(percent, 100),
          status,
        }
      })
      .filter((debt: any) => debt.status !== 'paid' && debt.status !== 'cancelled')
  }, [localDebts, debtPaymentsById])

  const pendings = useMemo(() => {
    const allPending = localTransactions.filter(
      (tx: any) => tx.status === 'pending'
    )

    const toPay = allPending
      .filter(
        (tx: any) =>
          getPendingDirection(tx) === 'payable' &&
          !tx.credit_card_id
      )
      .reduce(
        (sum: number, tx: any) =>
          sum + safeNumber(tx.amount),
        0
      )

    const transactionReceivables = allPending
      .filter((tx: any) =>
        isStandalonePendingReceivable(tx)
      )
      .reduce(
        (sum: number, tx: any) =>
          sum + safeNumber(tx.amount),
        0
      )

    const debtReceivables = debtsList.reduce(
      (sum: number, debt: any) =>
        sum +
        getDebtRemainingAmount(
          safeNumber(debt.total_amount),
          safeNumber(debt.paid_amount)
        ),
      0
    )

    const toReceive =
      transactionReceivables + debtReceivables

    const faturas = cards.reduce(
      (sum: number, card: any) =>
        sum + safeNumber(card.faturaAtual),
      0
    )

    return {
      toPay,
      toReceive,
      faturas,
      transactionReceivables,
      debtReceivables,
    }
  }, [localTransactions, cards, debtsList])

  const homePriorityAlerts = useMemo(() => {
    type HomePriorityAlert = {
      id: string
      kind: 'debt' | 'card' | 'transaction'
      direction: 'receivable' | 'payable' | 'invoice'
      title: string
      subtitle: string
      amount: number
      severity: number
      targetId: string
    }

    const alerts: HomePriorityAlert[] = []

    for (const debt of debtsList) {
      const dueState = getDebtDueState(debt.due_date)

      if (
        !dueState.isOverdue &&
        !dueState.isToday &&
        !dueState.isNearDue
      ) {
        continue
      }

      const remaining = getDebtRemainingAmount(
        safeNumber(debt.total_amount),
        safeNumber(debt.paid_amount)
      )

      if (remaining <= 0) continue

      const daysOverdue = Math.abs(
        dueState.daysUntilDue || 0
      )

      const dueLabel = dueState.isToday
        ? 'Vence hoje'
        : dueState.isOverdue
          ? `Atrasado há ${daysOverdue} dia${daysOverdue === 1 ? '' : 's'}`
          : dueState.daysUntilDue === 1
            ? 'Vence amanhã'
            : `Vence em ${dueState.daysUntilDue} dias`

      alerts.push({
        id: `debt-${debt.id}`,
        kind: 'debt',
        direction: 'receivable',
        title: debt.person_name || 'Valor a receber',
        subtitle: `A receber · ${dueLabel}`,
        amount: remaining,
        severity: dueState.isOverdue
          ? 0
          : dueState.isToday
            ? 1
            : 2,
        targetId: debt.id,
      })
    }

    for (const tx of localTransactions) {
      const direction = getPendingDirection(tx)

      if (!direction) continue

      if (
        direction === 'receivable' &&
        tx.debt_id
      ) {
        continue
      }

      const dueState = getDueDateState(tx.date)

      if (
        !dueState.isOverdue &&
        !dueState.isToday &&
        !(
          dueState.daysUntilDue !== null &&
          dueState.daysUntilDue > 0 &&
          dueState.daysUntilDue <= 3
        )
      ) {
        continue
      }

      const daysOverdue = Math.abs(
        dueState.daysUntilDue || 0
      )

      const dueLabel = dueState.isToday
        ? 'Vence hoje'
        : dueState.isOverdue
          ? `Atrasado há ${daysOverdue} dia${daysOverdue === 1 ? '' : 's'}`
          : dueState.daysUntilDue === 1
            ? 'Vence amanhã'
            : `Vence em ${dueState.daysUntilDue} dias`

      alerts.push({
        id: `transaction-${tx.id}`,
        kind: 'transaction',
        direction,
        title:
          tx.description ||
          (direction === 'receivable'
            ? 'Receita pendente'
            : 'Despesa pendente'),
        subtitle: `${getPendingLabel(tx)} · ${dueLabel}`,
        amount: safeNumber(tx.amount),
        severity: dueState.isOverdue
          ? 0
          : dueState.isToday
            ? 1
            : 2,
        targetId: tx.id,
      })
    }

    for (const card of cards) {
      const amount = safeNumber(card.faturaAtual)

      if (amount <= 0) continue

      const days = getDaysUntilCardDue(
        card.due_day,
        today
      )

      if (days < 0 || days > 5) continue

      alerts.push({
        id: `card-${card.id}`,
        kind: 'card',
        direction: 'invoice',
        title: card.name || 'Cartão',
        subtitle:
          days === 0
            ? 'Fatura · Vence hoje'
            : days === 1
              ? 'Fatura · Vence amanhã'
              : `Fatura · Vence em ${days} dias`,
        amount,
        severity:
          days === 0
            ? 1
            : days <= 2
              ? 2
              : 3,
        targetId: card.id,
      })
    }

    return alerts.sort(
      (a, b) =>
        a.severity - b.severity ||
        b.amount - a.amount
    )
  }, [debtsList, localTransactions, cards, today])

  const visiblePriorityAlerts = homePriorityAlerts.slice(0, 3)
  const hiddenPriorityAlertsCount = Math.max(
    0,
    homePriorityAlerts.length - visiblePriorityAlerts.length
  )

  const financings = localFinancings

  const spentByCategory = useMemo(() => {
    const result = new Map<string, number>()

    for (const tx of monthTransactions) {
      if (
        !tx.category_id ||
        tx.status !== 'done' ||
        (tx.type !== 'expense' && tx.type !== 'sangria')
      ) continue

      result.set(
        tx.category_id,
        (result.get(tx.category_id) || 0) + safeNumber(tx.amount)
      )
    }

    return result
  }, [monthTransactions])

  const budgets = useMemo(() => {
    const budgetsWithSpent = localBudgets.map((budget: any) => {
      const cat = categoryById.get(budget.category_id) as any
      const spent = spentByCategory.get(budget.category_id) || 0
      const amount = safeNumber(budget.amount)
      const remaining = amount - spent
      const percent = amount > 0 ? (spent / amount) * 100 : 0

      return {
        ...budget,
        name: cat?.name ?? budget.name,
        icon: cat?.icon ?? budget.icon,
        color: cat?.color ?? budget.color,
        spent,
        remaining,
        percent: Math.min(percent, 100),
      }
    })

    return budgetsWithSpent
      .sort((a: any, b: any) => b.percent - a.percent)
      .slice(0, 3)
  }, [localBudgets, categoryById, spentByCategory])

  const loans = useMemo(() => {
    return localLoans
      .filter((l: any) => l.status === 'active' || l.status === 'completed')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [localLoans])

  const notificationsMap = useMemo(() => {
    return localNotifications
      .map((n: any) => ({ ...n, isRead: n.is_read || n.isRead, cardId: n.card_id || n.cardId }))
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [localNotifications])

  const unreadNotifications = useMemo(() => notificationsMap.filter((n: any) => !n.isRead).length, [notificationsMap])
  const criticalCount = useMemo(() => notificationsMap.filter((n: any) => n.severity === 'critical' && !n.isRead).length, [notificationsMap])

  useEffect(() => {
    if (!user?.id || localCards.length === 0) return

    const generateNotifs = async () => {
      const now = new Date()

      const realCards = localCards.map((card: any) => {
        const cycle = getCardBillingCycleForMonth(
          card,
          now
        )

        const faturaAtual = localTransactions
          .filter(
            (t: any) =>
              t.credit_card_id === card.id &&
              t.type === 'expense' &&
              t.affects_balance !== true &&
              isTransactionInCardCycle(
                card,
                t.date,
                cycle.closingDate
              )
          )
          .reduce(
            (acc: number, t: any) =>
              acc + safeNumber(t.amount),
            0
          )

        return {
          ...card,
          faturaAtual,
          billingCycle: cycle,
        }
      })

      let addedNew = false

      for (const card of realCards) {
        if (safeNumber(card.faturaAtual) <= 0) continue

        const dueDate = new Date(
          `${card.billingCycle.dueDate}T12:00:00`
        )

        const referenceDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          12,
          0,
          0,
          0
        )

        const days = differenceInDays(
          dueDate,
          referenceDate
        )

        if (days > 3) continue

        const dueKey =
          `${dueDate.getFullYear()}-${String(
            dueDate.getMonth() + 1
          ).padStart(2, '0')}`

        const notifData = {
          id: `invoice-soon-${card.id}-${dueKey}`,
          user_id: user.id,
          type: 'invoice_soon',
          title: `Fatura próxima: ${card.name}`,
          subtitle:
            days === 0
              ? 'Vence hoje'
              : days === 1
              ? 'Vence amanhã'
              : `Vence em ${days} dias`,
          card_id: card.id,
          severity: 'warning',
          read: false,
          created_at: new Date().toISOString()
        }

        const existing = await db
          .table('notifications')
          .get(notifData.id)

        if (!existing) {
          // Esta notificação é derivada dos próprios dados locais do cartão.
          // Não precisa entrar na fila remota: qualquer dispositivo pode
          // reconstruí-la a partir dos dados financeiros sincronizados.
          await db.table('notifications').put({
            ...notifData,
            sync_status: 'synced'
          })

          addedNew = true
        }
      }

      if (addedNew) {
        reloadNotifs()
      }
    }

    generateNotifs()
  }, [
    localCards,
    localTransactions,
    user?.id,
    reloadNotifs
  ])

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

      await forceSync()

      setRefreshing(false)
      showToast('Dados atualizados!', 'success')
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

  const toggleSection = (id: string) => { setPersonalizeEnabled(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const moveSection = (id: string, direction: 'up' | 'down') => { setPersonalizeOrder((prev) => { const currentIndex = prev.findIndex((item) => item.id === id); if (currentIndex === -1) return prev; const newOrder = [...prev]; const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1; if (targetIndex >= 0 && targetIndex < newOrder.length) { [newOrder[currentIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[currentIndex]] } return newOrder }) }
  const handleSavePersonalize = () => { const finalOrder = personalizeOrder.filter(s => personalizeEnabled.has(s.id)).map(s => s.id); saveLayout(finalOrder); setShowPersonalizeModal(false); showToast('Tela inicial personalizada!', 'success'); hapticSuccess() }
  const openPersonalize = () => { const enabledOrder = enabledSections.map(id => ALL_SECTIONS.find(s => s.id === id)).filter(Boolean) as typeof ALL_SECTIONS; const missing = ALL_SECTIONS.filter(s => !enabledSections.includes(s.id)); setPersonalizeOrder([...enabledOrder, ...missing]); setPersonalizeEnabled(new Set(enabledSections)); setShowPersonalizeModal(true) }

  const formatCurrency = (val: number) => `R$ ${safeNumber(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const totalAccountsBalance = accounts.reduce((acc, curr) => acc + safeNumber(curr.balance), 0)

  const openCards = cards.filter(
    (card: any) => safeNumber(card.faturaAtual) > 0
  )

  const sortedByDue = [...openCards].sort(
    (a: any, b: any) =>
      getNextCardDueDate(a.due_day, today).getTime() -
      getNextCardDueDate(b.due_day, today).getTime()
  )

  const nextCard =
    sortedByDue.length > 0
      ? sortedByDue[0]
      : null

  const allCardsPaid =
    cards.length > 0 &&
    openCards.length === 0

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
    setUndoToast({ message: `"${removedLabel}" ocultado`, onUndo: () => { setEnabledSections(prev => { const restored = [...prev, removedSection]; return restored.sort((a, b) => { const idxA = ALL_SECTIONS.findIndex(s => s.id === a); const idxB = ALL_SECTIONS.findIndex(s => s.id === b); return idxA - idxB }) }); showToast(`"${removedLabel}" restaurado`, 'success'); setUndoToast(null) } })
    setTimeout(() => { setEnabledSections(current => { if (!current.includes(removedSection)) saveLayout(current); return current }); setUndoToast(null) }, 3500)
  }

  const getBalanceStyle = (val: number) => { if (val > 0) return 'text-emerald-600 font-semibold'; if (val < 0) return 'text-red-500 font-semibold'; return 'text-gray-800 dark:text-gray-200 font-semibold' }

  const goToTransaction = (id?: string) => { if (!id) return; safeNavigate(router, '/transactions/details', id) }
  const goToLoan = (id?: string) => { if (!id) return; safeNavigate(router, '/loans/details', id) }
  const goToCard = (id?: string) => { if (!id) return; safeNavigate(router, '/cards/details', id) }
  const goToDebt = (id?: string) => { if (!id) return; safeNavigate(router, '/debts/details', id) }
  const goToFinancing = (id?: string) => { if (!id) return; safeNavigate(router, '/financings/details', id) }
  const goToBudget = (id?: string) => { if (!id) return; safeNavigate(router, '/budgets/details', id) }
  const goToAccount = (id?: string) => { if (!id) return; safeNavigate(router, '/accounts/details', id) }

  const renderSection = (sectionId: string) => {
    const sectionLabel = ALL_SECTIONS.find(s => s.id === sectionId)?.label || sectionId
    const isFixed = FIXED_SECTIONS.includes(sectionId)

    switch (sectionId) {
      case 'balance':
        return (
          <div key="balance" className="mb-5">
            <div className="relative overflow-hidden rounded-[22px] border border-gray-200/80 bg-white px-5 py-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-800 dark:shadow-none">
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

              <button
                onClick={() => {
                  vibrate([5])
                  router.push('/transactions')
                }}
                className="relative z-10 w-full text-left group transition-transform active:scale-[0.98]"
              >
                <h1
                  className={`text-[34px] leading-none font-semibold ${
                    hideBalance
                      ? "text-gray-900 dark:text-gray-50 tracking-[0.18em]"
                      : totalAccountsBalance > 0
                        ? "text-emerald-600 dark:text-emerald-400 tracking-tight"
                        : totalAccountsBalance < 0
                          ? "text-red-500 dark:text-red-400 tracking-tight"
                          : "text-gray-900 dark:text-gray-50 tracking-tight"
                  }`}
                >
                  {hideBalance ? "••••" : formatCurrency(totalAccountsBalance)}
                </h1>

              </button>
            </div>
          </div>
        )
      case 'income-expense':
        return (
          <div key="income-expense" className="mb-5">
            <div className="overflow-hidden rounded-[22px] border border-gray-200/80 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="px-4 pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                  Movimentação do mês
                </p>
              </div>

              <div className="grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => router.push("/transactions?filter=income")}
                  className="group flex min-w-0 items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-slate-700/40 dark:active:bg-slate-700"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <ArrowUp size={18} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                      Receitas
                    </p>
                    <p className="mt-1 truncate text-[17px] font-bold leading-none text-emerald-600 dark:text-emerald-400">
                      {hideBalance ? "••••" : formatCurrency(summary.income)}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/transactions?filter=expense")}
                  className="group flex min-w-0 items-center gap-3 border-l border-gray-100 px-4 py-4 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 dark:border-slate-700/70 dark:hover:bg-slate-700/40 dark:active:bg-slate-700"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400">
                    <ArrowDown size={18} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                      Despesas
                    </p>
                    <p className="mt-1 truncate text-[17px] font-bold leading-none text-red-500 dark:text-red-400">
                      {hideBalance ? "••••" : formatCurrency(summary.expense)}
                    </p>
                  </div>
                </button>
              </div>

              <button
                type="button"
                onClick={() => router.push('/analysis')}
                className="flex w-full items-center justify-between border-t border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 dark:border-slate-700/70 dark:hover:bg-slate-700/40 dark:active:bg-slate-700"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                    Resultado do mês
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    Receitas menos despesas
                  </p>
                </div>

                <p
                  className={`text-[15px] font-bold ${
                    summary.balance > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : summary.balance < 0
                      ? 'text-red-500 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {hideBalance ? '••••' : formatCurrency(summary.balance)}
                </p>
              </button>
            </div>
          </div>
        )
      case 'projection':
        return (
          <div key="projection" className="mb-5 relative">
            {!isFixed && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleHideCard('projection', 'Projeção de Saldo')
                }}
                className="absolute bottom-3 right-3 z-10 p-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
                title="Ocultar seção"
              >
                <EyeOff size={13} />
              </button>
            )}

            <ProjectionChart
              hideBalance={hideBalance}
              formatCurrency={formatCurrency}
            />
          </div>
        )
      case 'loans':
        if (appMode === 'personal_only') return null
        if (loans.length === 0) return null
        return (
          <div key="loans" className="mb-5 relative">
            {!isFixed && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleHideCard('loans', 'Empréstimos entre Contextos')
                }}
                className="absolute bottom-3 right-3 z-10 p-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
                title="Ocultar seção"
              >
                <EyeOff size={13} />
              </button>
            )}

            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/loans")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Empréstimos entre Contextos
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="flex flex-col">
                {loans.slice(0, 3).map((loan: any, index: number) => {
                  const progress = safeNumber(loan.total_amount) > 0
                    ? ((safeNumber(loan.total_amount) - safeNumber(loan.remaining_amount)) / safeNumber(loan.total_amount)) * 100
                    : 0;
                  const dueDate = safeDate(loan.due_date)
                  const isOverdue = dueDate ? differenceInDays(dueDate, today) < 0 : false;

                  return (
                    <div
                      key={loan.id}
                      onClick={() => goToLoan(loan.id)}
                      className={`cursor-pointer px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:bg-gray-100 ${
                        index !== Math.min(loans.length, 3) - 1 ? "border-b border-gray-100 dark:border-slate-700/50" : ""
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
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

                      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
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
                onClick={(e) => {
                  e.stopPropagation()
                  handleHideCard("next-card", "Próxima Fatura")
                }}
                className="absolute bottom-3 right-3 z-10 p-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
                title="Ocultar seção"
              >
                <EyeOff size={13} />
              </button>
            )}

            {nextCard ? (
              <button
                type="button"
                onClick={() => goToCard(nextCard.id)}
                className="w-full overflow-hidden rounded-[24px] border border-orange-200/70 bg-white text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99] dark:border-orange-900/40 dark:bg-slate-800"
              >
                <div className="flex items-center justify-between gap-3 px-4 pt-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-orange-50 text-orange-500 dark:bg-orange-500/10">
                      <CreditCard size={20} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-orange-500">
                        Próxima fatura
                      </p>
                      <p className="truncate text-[14px] font-semibold text-gray-900 dark:text-gray-100">
                        {nextCard.name}
                      </p>
                    </div>
                  </div>

                  <ChevronRight size={18} className="shrink-0 text-orange-300 dark:text-orange-700" />
                </div>

                <div className="flex items-end justify-between gap-4 px-4 pb-4 pt-3">
                  <div>
                    <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
                      Valor em aberto
                    </p>
                    <p className="mt-1 text-[22px] font-bold leading-none tracking-tight text-orange-500">
                      {hideBalance ? "••••" : formatCurrency(safeNumber(nextCard.faturaAtual))}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-full bg-orange-50 px-3 py-1.5 text-[11px] font-semibold text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                    Vence dia {nextCard.due_day}
                  </div>
                </div>
              </button>
            ) : allCardsPaid ? (
              <div className="flex items-center gap-3 rounded-[20px] border border-emerald-200/70 bg-emerald-50/40 px-4 py-3.5 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
                  <Check size={17} />
                </div>

                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Faturas em dia
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-500">
                    Nenhuma fatura aberta neste período.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )
      case 'pendings': {
        const hasPendingItems =
          safeNumber(pendings.toPay) > 0 ||
          safeNumber(pendings.toReceive) > 0 ||
          safeNumber(pendings.faturas) > 0

        const hasPriorities = visiblePriorityAlerts.length > 0

        return (
          <div key="pendings" className="mb-5">
            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                    Atenção agora
                  </p>
                  <h3 className="mt-0.5 text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                    {hasPriorities ? 'Prioridades' : 'Pendências'}
                  </h3>
                </div>

                {hasPriorities ? (
                  <div className="flex h-8 min-w-8 items-center justify-center rounded-full bg-orange-50 px-2 text-[11px] font-bold text-orange-500 dark:bg-orange-500/10 dark:text-orange-400">
                    {homePriorityAlerts.length}
                  </div>
                ) : hasPendingItems ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400">
                    <Clock size={15} />
                  </div>
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Check size={15} />
                  </div>
                )}
              </div>

              {hasPriorities && (
                <div className="border-t border-gray-100 dark:border-slate-700/60">
                  {visiblePriorityAlerts.map((alert, index) => {
                    const isDebt = alert.kind === 'debt'
                    const isCard = alert.kind === 'card'
                    const isTransaction =
                      alert.kind === 'transaction'
                    const isReceivable =
                      alert.direction === 'receivable'
                    const isPayable =
                      alert.direction === 'payable'
                    const isCritical = alert.severity === 0
                    const isToday =
                      alert.subtitle.includes('Vence hoje')

                    return (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => {
                          if (isDebt) {
                            goToDebt(alert.targetId)
                            return
                          }

                          if (isTransaction) {
                            goToTransaction(alert.targetId)
                            return
                          }

                          goToCard(alert.targetId)
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-slate-700/50 ${
                          index !== visiblePriorityAlerts.length - 1
                            ? 'border-b border-gray-100 dark:border-slate-700/50'
                            : ''
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${
                              isReceivable
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : isPayable
                                  ? 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400'
                                  : 'bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400'
                            }`}
                          >
                            {isDebt ? (
                              <User size={16} />
                            ) : isCard ? (
                              <CreditCard size={16} />
                            ) : isReceivable ? (
                              <ArrowUp size={16} />
                            ) : (
                              <ArrowDown size={16} />
                            )}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                              {alert.title}
                            </p>
                            <p
                              className={`mt-0.5 text-[11px] font-medium ${
                                isCritical
                                  ? 'text-red-500 dark:text-red-400'
                                  : isToday
                                    ? 'text-orange-500 dark:text-orange-400'
                                    : 'text-amber-500 dark:text-amber-400'
                              }`}
                            >
                              {alert.subtitle}
                            </p>
                          </div>
                        </div>

                        <p
                          className={`shrink-0 text-[14px] font-bold ${
                            isReceivable
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isPayable
                                ? 'text-red-500 dark:text-red-400'
                                : 'text-orange-500 dark:text-orange-400'
                          }`}
                        >
                          {hideBalance ? '••••' : formatCurrency(alert.amount)}
                        </p>
                      </button>
                    )
                  })}

                  {hiddenPriorityAlertsCount > 0 && (
                    <div className="border-t border-gray-100 px-4 py-2.5 text-center text-[11px] font-medium text-gray-400 dark:border-slate-700/50 dark:text-gray-500">
                      +{hiddenPriorityAlertsCount}{' '}
                      {hiddenPriorityAlertsCount === 1
                        ? 'prioridade fora do resumo'
                        : 'prioridades fora do resumo'}
                    </div>
                  )}
                </div>
              )}

              {hasPendingItems && (
                <div
                  className={`grid grid-cols-3 gap-1 px-2 pb-2 pt-2 ${
                    hasPriorities
                      ? 'border-t border-gray-100 dark:border-slate-700/60'
                      : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => router.push('/transactions?filter=pending&kind=payable')}
                    className="min-w-0 rounded-[16px] px-2 py-2.5 text-left transition-colors hover:bg-red-50/60 active:scale-[0.97] dark:hover:bg-red-500/5"
                  >
                    <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                      A pagar
                    </p>
                    <p
                      className={`mt-1 truncate text-[12px] font-bold ${
                        safeNumber(pendings.toPay) > 0
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    >
                      {hideBalance ? '•••' : formatCurrency(pendings.toPay)}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push('/transactions?filter=pending&kind=receivable')}
                    className="min-w-0 rounded-[16px] px-2 py-2.5 text-left transition-colors hover:bg-emerald-50/60 active:scale-[0.97] dark:hover:bg-emerald-500/5"
                  >
                    <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                      A receber
                    </p>
                    <p
                      className={`mt-1 truncate text-[12px] font-bold ${
                        safeNumber(pendings.toReceive) > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    >
                      {hideBalance ? '•••' : formatCurrency(pendings.toReceive)}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push('/cards')}
                    className="min-w-0 rounded-[16px] px-2 py-2.5 text-left transition-colors hover:bg-orange-50/60 active:scale-[0.97] dark:hover:bg-orange-500/5"
                  >
                    <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-gray-500 dark:text-gray-400">
                      Faturas
                    </p>
                    <p
                      className={`mt-1 truncate text-[12px] font-bold ${
                        safeNumber(pendings.faturas) > 0
                          ? 'text-orange-500 dark:text-orange-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    >
                      {hideBalance ? '•••' : formatCurrency(pendings.faturas)}
                    </p>
                  </button>
                </div>
              )}

              {!hasPriorities && !hasPendingItems && (
                <div className="border-t border-gray-100 px-4 py-3 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 rounded-[16px] bg-emerald-50/60 px-3 py-3 dark:bg-emerald-500/5">
                    <Check size={15} className="shrink-0 text-emerald-500" />
                    <p className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                      Tudo em dia. Nenhuma prioridade financeira aberta.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }
      case 'receivables':
        if (debtsList.length === 0) return null
        return (
          <div key="receivables" className="mb-5 relative">
            {!isFixed && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleHideCard("receivables", "A Receber")
                }}
                className="absolute bottom-3 right-3 z-10 p-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
                title="Ocultar seção"
              >
                <EyeOff size={13} />
              </button>
            )}

            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/debts")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  A Receber
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="flex flex-col">
                {debtsList.slice(0, 3).map((debt: any, index: number) => {
                  const IconComp = getDynamicIcon(debt.icon || "user");
                  const remaining = safeNumber(debt.total_amount) - safeNumber(debt.paid_amount);
                  const dueState = getDebtDueState(debt.due_date);
                  const daysUntilDue = dueState.daysUntilDue;
                  const isOverdue = dueState.isOverdue;
                  const isDueToday = dueState.isToday;
                  const percent = Math.min(debt.percent, 100);

                  return (
                    <div
                      key={debt.id}
                      onClick={() => goToDebt(debt.id)}
                      className={`cursor-pointer px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:bg-gray-100 ${
                        index !== Math.min(debtsList.length, 3) - 1 ? "border-b border-gray-100 dark:border-slate-700/50" : ""
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
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
                                ? `Atrasado ${Math.abs(daysUntilDue || 0)} dia${Math.abs(daysUntilDue || 0) === 1 ? '' : 's'}`
                                : isDueToday
                                ? 'Vence hoje'
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

                      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
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
                onClick={(e) => {
                  e.stopPropagation()
                  handleHideCard("financings", "Financiamentos")
                }}
                className="absolute bottom-3 right-3 z-10 p-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
                title="Ocultar seção"
              >
                <EyeOff size={13} />
              </button>
            )}

            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/financings")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Financiamentos
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="flex flex-col">
                {financings.slice(0, 3).map((fin: any, index: number) => {
                  const IconComp = getDynamicIcon(fin.icon || "wallet");
                  const remaining = safeNumber(fin.total_installments) - safeNumber(fin.current_installment) + 1;
                  const dueDate = safeDate(fin.next_due_date);
                  const isOverdue = dueDate ? differenceInDays(dueDate, today) < 0 : false;

                  return (
                    <div
                      key={fin.id}
                      onClick={() => goToFinancing(fin.id)}
                      className={`cursor-pointer px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:bg-gray-100 ${
                        index !== Math.min(financings.length, 3) - 1 ? "border-b border-gray-100 dark:border-slate-700/50" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
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

                        <div className="shrink-0 pt-2">
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
                onClick={(e) => {
                  e.stopPropagation()
                  handleHideCard("budgets", "Orçamentos")
                }}
                className="absolute bottom-3 right-3 z-10 p-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 border border-gray-200/60 dark:border-slate-700/60 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm"
                title="Ocultar seção"
              >
                <EyeOff size={13} />
              </button>
            )}

            <div className="overflow-hidden rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
              <div
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/budgets")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Orçamentos Ativos
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="flex flex-col">
                {budgets.map((budget: any, index: number) => {
                  const IconComp = getDynamicIcon(budget.icon || "wallet");
                  const isWarning = budget.percent >= 80 && budget.remaining > 0;
                  const isDanger = budget.remaining <= 0;

                  return (
                    <div
                      key={budget.id}
                      onClick={() => goToBudget(budget.id)}
                      className={`cursor-pointer px-4 py-3.5 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:bg-gray-100 ${
                        index !== budgets.length - 1 ? "border-b border-gray-100 dark:border-slate-700/50" : ""
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]"
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

                      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
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
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/accounts")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Contas
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="flex flex-col">
                {accounts.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={Wallet}
                      title="Nenhuma conta"
                      message="Você ainda não registrou nenhuma conta bancária neste contexto."
                    />
                  </div>
                ) : (
                  accounts.slice(0, 4).map((acc: any, index: number) => (
                    <div
                      key={acc.id}
                      onClick={() => goToAccount(acc.id)}
                      className={`flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:bg-gray-100 ${
                        index !== Math.min(accounts.length, 4) - 1 ? "border-b border-gray-100 dark:border-slate-700/50" : ""
                      }`}
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

                {accounts.length > 4 && (
                  <button
                    type="button"
                    onClick={() => router.push('/accounts')}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-gray-100 px-4 py-3 text-[12px] font-semibold text-gray-500 transition-colors hover:bg-gray-50 active:bg-gray-100 dark:border-slate-700/60 dark:text-gray-400 dark:hover:bg-slate-700/40"
                  >
                    Ver todas as {accounts.length} contas
                    <ChevronRight size={14} />
                  </button>
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
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/cards")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Cartões de Crédito
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="flex flex-col">
                {cards.length === 0 ? (
                  <div className="px-4 pb-4">
                    <EmptyState
                      icon={CreditCard}
                      title="Nenhum cartão"
                      message="Adicione seu primeiro cartão de crédito para acompanhar as faturas."
                      actionLabel="Adicionar cartão"
                      onAction={() => router.push("/cards/new")}
                    />
                  </div>
                ) : (
                  cards.map((card: any, index: number) => (
                    <div
                      key={card.id}
                      onClick={() => goToCard(card.id)}
                      className={`flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 active:bg-gray-100 ${
                        index !== cards.length - 1 ? "border-b border-gray-100 dark:border-slate-700/50" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-[12px] text-white shadow-sm shrink-0"
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
                className="flex items-center justify-between px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/30 active:bg-gray-100 dark:active:bg-slate-700"
                onClick={() => router.push("/transactions")}
              >
                <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
                  Transações Recentes
                </h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>

              <div className="flex flex-col">
                {recentTransactions.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={SearchX}
                      title="Sem movimentações"
                      message="Você ainda não possui transações recentes registradas neste recorte."
                    />
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
                        className={`flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer transition-colors active:bg-gray-100 hover:bg-gray-50 dark:hover:bg-slate-700/50 ${
                          isPending ? "bg-amber-50/50 dark:bg-amber-900/10" : ""
                        } ${
                          index !== recentTransactions.length - 1 ? "border-b border-gray-100 dark:border-slate-700/50" : ""
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-[12px] shrink-0"
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
    <div ref={containerRef} className="relative mx-auto min-h-[100dvh] max-w-md bg-gray-50 px-4 pb-28 pt-[max(0.75rem,env(safe-area-inset-top))] font-sans transition-colors duration-300 dark:bg-slate-900">
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

      <div className="mb-3.5 flex items-start justify-between gap-3">
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
        className="mt-1 flex w-full items-center justify-center gap-2 rounded-[18px] border border-gray-200/80 bg-white py-3 text-[13px] font-semibold text-gray-500 shadow-sm transition-all hover:bg-gray-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700"
      >
        <Settings2 size={20} />
        <span>Personalizar início</span>
      </button>


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
