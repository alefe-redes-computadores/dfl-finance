'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  Eye,
  EyeOff,
  ChevronRight,
  ChevronLeft,
  ArrowDown,
  ArrowUp,
  Loader2,
  Plus,
  Clock,
  Check,
  CreditCard
} from 'lucide-react'
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { ContextProvider, useContext_ } from '@/components/ContextToggle'
import { useOfflineQueue } from '@/hooks/useOfflineQueue'
import NetworkStatus from '@/components/NetworkStatus'
import InvoiceAlert from '@/components/InvoiceAlert'
import NotificationBell from '@/components/NotificationBell'
import NotificationCenter from '@/components/NotificationCenter'

function BankInitials({ color, name }: { color: string; name: string }) {
  const initials = name ? name.substring(0, 2).toUpperCase() : '??'
  return (
    <div
      className="w-10 h-10 rounded-[14px] flex items-center justify-center text-xs font-bold text-white shadow-sm flex-shrink-0"
      style={{ backgroundColor: color || '#64748b' }}
    >
      {initials}
    </div>
  )
}

function HomeContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [pendings, setPendings] = useState({ toPay: 0, toReceive: 0, faturas: 0 })
  const [accounts, setAccounts] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [budgets, setBudgets] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [dataLoading, setDataLoading] = useState(true)
  const [showNotifications, setShowNotifications] = useState(false)

  const { isOnline, pendingCount } = useOfflineQueue()

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })

  const getBalanceStyle = (val: number) => {
    if (val > 0) return 'text-emerald-600 font-bold'
    if (val < 0) return 'text-red-500 font-bold'
    return 'text-gray-800 dark:text-gray-200 font-bold'
  }

  const loadData = useCallback(async () => {
    if (!user) return
    setDataLoading(true)

    try {
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

      const [{ data: transactions }, { data: subsData }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, categories(name, icon, color)')
          .match({ user_id: user.id, context: context })
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: false }),
        supabase
          .from('subscriptions')
          .select('*, categories(name, icon, color), accounts(name)')
          .match({ user_id: user.id, context: context, status: 'active' })
          .order('due_day', { ascending: true })
      ])

      const txs = Array.isArray(transactions) ? transactions : []
      setSubscriptions(Array.isArray(subsData) ? subsData : [])

      const income = txs
        .filter((t) => t.type === 'income' && t.status === 'done')
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const expense = txs
        .filter(
          (t) =>
            (t.type === 'expense' || t.type === 'sangria') &&
            t.status === 'done'
        )
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)

      const toPay = txs
        .filter(
          (t) =>
            (t.type === 'expense' || t.type === 'sangria') &&
            t.status === 'pending' &&
            !t.credit_card_id
        )
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const toReceive = txs
        .filter((t) => t.type === 'income' && t.status === 'pending')
        .reduce((a, t) => a + (Number(t.amount) || 0), 0)

      setSummary({ income, expense, balance: income - expense })
      setRecentTransactions(txs.slice(0, 5))

      const { data: accsData } = await supabase
        .from('accounts')
        .select('*')
        .match({ user_id: user.id, context: context })
        .order('name')

      const accsWithPrevisto = (Array.isArray(accsData) ? accsData : []).map(
        (acc) => {
          const accTxs = txs.filter(
            (t) => t.account_id === acc.id && t.status === 'pending'
          )
          const pendingIncome = accTxs
            .filter((t) => t.type === 'income')
            .reduce((a, t) => a + (Number(t.amount) || 0), 0)
          const pendingExpense = accTxs
            .filter(
              (t) => t.type === 'expense' || t.type === 'sangria'
            )
            .reduce((a, t) => a + (Number(t.amount) || 0), 0)
          const previsto =
            (Number(acc.balance) || 0) + pendingIncome - pendingExpense
          return { ...acc, previsto }
        }
      )
      setAccounts(accsWithPrevisto)

      const { data: creditCards } = await supabase
        .from('credit_cards')
        .select('*')
        .match({ user_id: user.id, context: context, is_archived: false })
        .order('created_at', { ascending: false })

      const cardsWithInvoice = (
        Array.isArray(creditCards) ? creditCards : []
      ).map((card) => {
        const cardTxs = txs.filter((t) => t.credit_card_id === card.id)
        const faturaAtual = cardTxs.reduce(
          (acc, t) => acc + (Number(t.amount) || 0),
          0
        )
        return { ...card, faturaAtual }
      })

      const totalFaturas = cardsWithInvoice.reduce(
        (acc, c) => acc + c.faturaAtual,
        0
      )

      setCards(cardsWithInvoice)
      setPendings({ toPay, toReceive, faturas: totalFaturas })

      const { data: budgetsData } = await supabase
        .from('budgets')
        .select('*, categories(name, icon, color)')
        .match({ user_id: user.id, context: context })
        .order('created_at', { ascending: false })

      const budgetsWithSpent = (budgetsData || []).map((budget) => {
        const spent = txs
          .filter(
            (t) =>
              t.category_id === budget.category_id &&
              (t.type === 'expense' || t.type === 'sangria') &&
              t.status === 'done'
          )
          .reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const remaining = Number(budget.amount) - spent
        const percent =
          Number(budget.amount) > 0
            ? (spent / Number(budget.amount)) * 100
            : 0
        return { ...budget, spent, remaining, percent: Math.min(percent, 100) }
      })

      setBudgets(
        budgetsWithSpent
          .sort((a, b) => b.percent - a.percent)
          .slice(0, 3)
      )
    } catch (err) {
      console.error('Erro na Home:', err)
    } finally {
      setDataLoading(false)
    }
  }, [context, currentDate, user])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const handleFocus = () => loadData()
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadData])

  const formatCurrency = (val: number) =>
    `R$ ${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const totalAccountsBalance = accounts.reduce(
    (acc, curr) => acc + (Number(curr.balance) || 0),
    0
  )
  const totalPrevistoBalance = accounts.reduce(
    (acc, curr) => acc + (curr.previsto || 0),
    0
  )

  const today = new Date()
  const todayDay = today.getDate()
  const sortedByDue = [...cards].sort((a, b) => {
    const aDue = a.due_day < todayDay ? a.due_day + 31 : a.due_day
    const bDue = b.due_day < todayDay ? b.due_day + 31 : b.due_day
    return aDue - bDue
  })
  const nextCard = sortedByDue.length > 0 ? sortedByDue[0] : null

  // === GERAR NOTIFICAÇÕES ===
  const notifications: any[] = []

  cards.forEach(card => {
    const days = card.due_day - todayDay
    if (days < 0) {
      notifications.push({
        id: `invoice-overdue-${card.id}`,
        type: 'invoice_overdue',
        title: `Fatura vencida: ${card.name}`,
        subtitle: `Venceu dia ${card.due_day} — ${formatCurrency(card.faturaAtual || 0)}`,
        cardId: card.id,
        severity: 'critical'
      })
    } else if (days <= 3) {
      notifications.push({
        id: `invoice-soon-${card.id}`,
        type: 'invoice_soon',
        title: `Fatura próxima: ${card.name}`,
        subtitle: `Vence em ${days} dia(s) — ${formatCurrency(card.faturaAtual || 0)}`,
        cardId: card.id,
        severity: 'warning'
      })
    }
  })

  subscriptions.forEach(sub => {
    const days = sub.due_day - todayDay
    if (days < 0) {
      notifications.push({
        id: `sub-overdue-${sub.id}`,
        type: 'subscription_overdue',
        title: `Assinatura vencida: ${sub.name}`,
        subtitle: `Venceu dia ${sub.due_day} — ${formatCurrency(Number(sub.amount) || 0)}`,
        subId: sub.id,
        severity: 'critical'
      })
    } else if (days <= 5) {
      notifications.push({
        id: `sub-soon-${sub.id}`,
        type: 'subscription_soon',
        title: `Assinatura próxima: ${sub.name}`,
        subtitle: `Vence em ${days} dia(s) — ${formatCurrency(Number(sub.amount) || 0)}`,
        subId: sub.id,
        severity: 'warning'
      })
    }
  })

  budgets.forEach(budget => {
    if (budget.remaining < 0) {
      notifications.push({
        id: `budget-over-${budget.id}`,
        type: 'budget_over',
        title: `Orçamento estourado: ${budget.name}`,
        subtitle: `Gasto ${formatCurrency(budget.spent)} de ${formatCurrency(Number(budget.amount))}`,
        budgetId: budget.id,
        severity: 'critical'
      })
    } else if (budget.percent >= 80) {
      notifications.push({
        id: `budget-warn-${budget.id}`,
        type: 'budget_warning',
        title: `Orçamento quase lá: ${budget.name}`,
        subtitle: `${budget.percent.toFixed(0)}% utilizado — ${formatCurrency(budget.remaining)} restante`,
        budgetId: budget.id,
        severity: 'warning'
      })
    }
  })

  const pendingExpenses = recentTransactions.filter(t => t.status === 'pending' && (t.type === 'expense' || t.type === 'sangria'))
  if (pendingExpenses.length > 0) {
    notifications.push({
      id: 'pending-expenses',
      type: 'pending_expense',
      title: `${pendingExpenses.length} despesa(s) pendente(s)`,
      subtitle: `Total: ${formatCurrency(pendings.toPay)}`,
      severity: 'info'
    })
  }

  const pendingIncomes = recentTransactions.filter(t => t.status === 'pending' && t.type === 'income')
  if (pendingIncomes.length > 0) {
    notifications.push({
      id: 'pending-incomes',
      type: 'pending_income',
      title: `${pendingIncomes.length} receita(s) a receber`,
      subtitle: `Total: ${formatCurrency(pendings.toReceive)}`,
      severity: 'success'
    })
  }

  const criticalCount = notifications.filter(n => n.severity === 'critical').length
  const totalNotifications = notifications.length

  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-teal-700 bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin" size={40} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans relative px-4 pt-6 transition-colors duration-300">
      <NetworkStatus isOnline={isOnline} pendingCount={pendingCount} />

      {cards.length > 0 && (
        <div className="mb-4 space-y-2">
          {cards.map(card => (
            <InvoiceAlert
              key={card.id}
              dueDay={card.due_day}
              closingDay={card.closing_day}
              cardName={card.name}
            />
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <ContextToggle />
        <div className="flex items-center gap-2">
          <NotificationBell
            count={totalNotifications}
            hasCritical={criticalCount > 0}
            onClick={() => setShowNotifications(true)}
          />
          <div className="flex items-center gap-3 bg-white dark:bg-slate-800 shadow-sm border border-gray-50 dark:border-slate-700 px-3 py-1.5 rounded-full">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-bold text-gray-800 dark:text-gray-200 capitalize tracking-wide">
              {monthLabel}
            </span>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-[24px] p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none border border-gray-50 dark:border-slate-700 mb-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">
            Saldo total
          </span>
          <button
            onClick={() => setHideBalance(!hideBalance)}
            className="text-gray-400 dark:text-gray-500 p-1 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <h1
          className={`text-[32px] font-light text-gray-800 dark:text-gray-100 ${
            hideBalance ? 'tracking-widest' : ''
          }`}
        >
          {hideBalance ? '••••••' : formatCurrency(totalAccountsBalance)}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div
          onClick={() => router.push('/transactions?filter=income')}
          className="bg-white dark:bg-slate-800 border border-gray-50 dark:border-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none rounded-[20px] p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowUp size={14} className="text-emerald-500" />
            <span className="text-[12px] text-gray-500 dark:text-gray-400 font-bold">
              Receitas
            </span>
          </div>
          <p className="text-[15px] font-bold text-emerald-600">
            {hideBalance ? '••••' : formatCurrency(summary.income)}
          </p>
        </div>
        <div
          onClick={() => router.push('/transactions?filter=expense')}
          className="bg-white dark:bg-slate-800 border border-gray-50 dark:border-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.02)] dark:shadow-none rounded-[20px] p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowDown size={14} className="text-red-400" />
            <span className="text-[12px] text-gray-500 dark:text-gray-400 font-bold">
              Despesas
            </span>
          </div>
          <p className="text-[15px] font-bold text-red-500">
            {hideBalance ? '••••' : formatCurrency(summary.expense)}
          </p>
        </div>
      </div>