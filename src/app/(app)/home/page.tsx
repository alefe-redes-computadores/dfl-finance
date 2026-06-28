'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { getDynamicIcon } from '@/lib/iconUtils'
import {
  Eye, EyeOff, ChevronRight, ChevronLeft, ArrowDown, ArrowUp,
  Loader2, Plus, Clock, Check, CreditCard, Wallet, Settings2,
  PieChart, AlertTriangle, Receipt, Banknote
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

const ALL_SECTIONS = [
  { id: 'balance', label: 'Saldo Total' },
  { id: 'income-expense', label: 'Receitas / Despesas' },
  { id: 'next-card', label: 'Próxima Fatura' },
  { id: 'invoices', label: 'Faturas de Cartão' },
  { id: 'pendings', label: 'Pendências' },
  { id: 'receivables', label: 'A Receber' },
  { id: 'financings', label: 'Financiamentos' },
  { id: 'budgets', label: 'Orçamentos' },
  { id: 'accounts', label: 'Contas' },
  { id: 'cards', label: 'Cartões' },
  { id: 'recent', label: 'Transações Recentes' },
]

const DEFAULT_SECTION_ORDER = ALL_SECTIONS.map(s => s.id)

function HomeContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { context } = useContext_()
  const { showToast } = useToast()
  const [hideBalance, setHideBalance] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [pendings, setPendings] = useState({ toPay: 0, toReceive: 0, faturas: 0 })
  const [accounts, setAccounts] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
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

  const [enabledSections, setEnabledSections] = useState<string[]>(DEFAULT_SECTION_ORDER)
  const [layoutLoaded, setLayoutLoaded] = useState(false)
  const [showPersonalizeModal, setShowPersonalizeModal] = useState(false)
  const [personalizeOrder, setPersonalizeOrder] = useState<typeof ALL_SECTIONS>(ALL_SECTIONS)
  const [personalizeEnabled, setPersonalizeEnabled] = useState<Set<string>>(new Set(DEFAULT_SECTION_ORDER))

  const { isOnline, pendingCount, isSyncing, syncQueue } = useOfflineQueue()

  const monthLabel = format(currentDate, 'MMMM', { locale: ptBR })

  const getBalanceStyle = (val: number) => {
    if (val > 0) return 'text-emerald-600 font-bold'
    if (val < 0) return 'text-red-600 font-bold'
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

      const [{ data: transactions }, { data: subsData }, { data: debtsData }, { data: financingsData }, { data: invoicesData }] = await Promise.all([
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
          .from('credit_invoices')
          .select('*, credit_cards(name, color, due_day)')
          .eq('user_id', user.id)
          .in('status', ['open', 'closed', 'partial'])
          .order('due_date', { ascending: true })
          .limit(5),
      ])

      const txs = Array.isArray(transactions) ? transactions : []
      setSubscriptions(Array.isArray(subsData) ? subsData : [])
      setFinancings(Array.isArray(financingsData) ? financingsData : [])
      setInvoices(Array.isArray(invoicesData) ? invoicesData : [])

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

      const income = txs.filter((t) => t.type === 'income' && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const expense = txs.filter((t) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0)

      const toPay = txs.filter((t) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'pending' && !t.credit_card_id).reduce((a, t) => a + (Number(t.amount) || 0), 0)
      const toReceive = txs.filter((t) => t.type === 'income' && t.status === 'pending').reduce((a, t) => a + (Number(t.amount) || 0), 0)

      setSummary({ income, expense, balance: income - expense })
      setRecentTransactions(txs.slice(0, 5))

      const { data: accsData } = await supabase.from('accounts').select('*').match({ user_id: user.id, context: context }).order('name')
      const accsWithPrevisto = (Array.isArray(accsData) ? accsData : []).map((acc) => {
        const accTxs = txs.filter((t) => t.account_id === acc.id && t.status === 'pending')
        const pendingIncome = accTxs.filter((t) => t.type === 'income').reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const pendingExpense = accTxs.filter((t) => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const previsto = (Number(acc.balance) || 0) + pendingIncome - pendingExpense
        return { ...acc, previsto }
      })
      setAccounts(accsWithPrevisto)

      const { data: creditCards } = await supabase.from('credit_cards').select('*').match({ user_id: user.id, context: context, is_archived: false }).order('created_at', { ascending: false })
      const cardsWithInvoice = (Array.isArray(creditCards) ? creditCards : []).map((card) => {
        const cardTxs = txs.filter((t) => t.credit_card_id === card.id)
        const faturaAtual = cardTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
        return { ...card, faturaAtual }
      })
      setCards(cardsWithInvoice)
      setPendings({ toPay, toReceive, faturas: cardsWithInvoice.reduce((acc, c) => acc + c.faturaAtual, 0) })

      const { data: budgetsData } = await supabase.from('budgets').select('*, categories(name, icon, color)').match({ user_id: user.id, context: context }).order('created_at', { ascending: false })
      const budgetsWithSpent = (budgetsData || []).map((budget) => {
        const spent = txs.filter((t) => t.category_id === budget.category_id && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0)
        const remaining = Number(budget.amount) - spent
        const percent = Number(budget.amount) > 0 ? (spent / Number(budget.amount)) * 100 : 0
        return { ...budget, spent, remaining, percent: Math.min(percent, 100) }
      })
      setBudgets(budgetsWithSpent.sort((a, b) => b.percent - a.percent).slice(0, 3))
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

  const notifications: any[] = []
  cards.forEach(card => {
    const days = card.due_day - todayDay
    if (days < 0) notifications.push({ id: `invoice-overdue-${card.id}`, type: 'invoice_overdue', title: `Fatura vencida: ${card.name}`, subtitle: `Venceu dia ${card.due_day} — ${formatCurrency(card.faturaAtual || 0)}`, cardId: card.id, severity: 'critical' })
    else if (days <= 3) notifications.push({ id: `invoice-soon-${card.id}`, type: 'invoice_soon', title: `Fatura próxima: ${card.name}`, subtitle: `Vence em ${days} dia(s) — ${formatCurrency(card.faturaAtual || 0)}`, cardId: card.id, severity: 'warning' })
  })
  subscriptions.forEach(sub => {
    const days = sub.due_day - todayDay
    if (days < 0) notifications.push({ id: `sub-overdue-${sub.id}`, type: 'subscription_overdue', title: `Assinatura vencida: ${sub.name}`, subtitle: `Venceu dia ${sub.due_day}`, subId: sub.id, severity: 'critical' })
    else if (days <= 5) notifications.push({ id: `sub-soon-${sub.id}`, type: 'subscription_soon', title: `Assinatura próxima: ${sub.name}`, subtitle: `Vence em ${days} dia(s)`, subId: sub.id, severity: 'warning' })
  })
  const criticalCount = notifications.filter(n => n.severity === 'critical').length

  useEffect(() => {
    if (!user) return
    const loadUnreadCount = async () => {
      const { data } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
      const readIds = new Set(data?.map(d => d.notification_id) || [])
      const unread = notifications.filter(n => !readIds.has(n.id)).length
      setUnreadNotifications(unread)
    }
    loadUnreadCount()
  }, [notifications, user])

  if (authLoading || dataLoading || !layoutLoaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-teal-700 bg-gray-50 dark:bg-slate-900">
        <Loader2 className="animate-spin" size={40} />
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
              <h1 className={`text-[36px] font-normal text-gray-800 dark:text-gray-100 tracking-tight ${hideBalance ? 'tracking-widest' : ''}`}>
                {hideBalance ? '••••••' : formatCurrency(totalAccountsBalance)}
              </h1>
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
                <p className="text-[16px] font-bold text-red-600">{hideBalance ? '••••' : formatCurrency(summary.expense)}</p>
              </div>
            </div>
          </div>
        )
      case 'next-card':
        if (!nextCard) return null
        return (
          <div key="next-card" className="mb-6">
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
          </div>
        )
      case 'invoices':
        if (invoices.length === 0) return null
        return (
          <div key="invoices" className="mb-6">
            <div className="bg-white dark:bg-slate-800 rounded-[24px] shadow-sm border border-gray-100 dark:border-slate-700/50 overflow-hidden">
              <div className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors" onClick={() => router.push('/cards')}>
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">Faturas de Cartão</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {invoices.slice(0, 3).map(invoice => {
                  const cardData = invoice.credit_cards
                  const remaining = Number(invoice.total_amount) - Number(invoice.paid_amount || 0)
                  const daysUntilDue = differenceInDays(new Date(invoice.due_date), today)
                  const isOverdue = daysUntilDue < 0
                  const isSoon = daysUntilDue >= 0 && daysUntilDue <= 3

                  return (
                    <div
                      key={invoice.id}
                      onClick={() => router.push(`/cards/${invoice.credit_card_id}`)}
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 text-white"
                          style={{ backgroundColor: cardData?.color || '#f97316' }}
                        >
                          <CreditCard size={20} />
                        </div>
                        <div>
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{cardData?.name || 'Cartão'}</p>
                          <p className={`text-[12px] font-medium mt-0.5 ${isOverdue ? 'text-red-500' : isSoon ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}`}>
                            {isOverdue ? `Atrasada ${Math.abs(daysUntilDue)} dia(s)` : isSoon ? `Vence em ${daysUntilDue} dia(s)` : `Vence ${format(new Date(invoice.due_date), "dd/MM")}`}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-[15px] font-bold ${isOverdue ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}`}>
                          {hideBalance ? '••••' : formatCurrency(remaining)}
                        </p>
                        {invoice.status === 'partial' && (
                          <p className="text-[10px] text-amber-600 font-medium mt-0.5">Pagamento parcial</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
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
                  <p className="text-[14px] font-bold text-red-600">{hideBalance ? '•••' : formatCurrency(pendings.toPay)}</p>
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
                <h3 className="text-[15px] font-bold text-gray-800 dark:text-gray-100">A Receber (Dívidas)</h3>
                <ChevronRight size={18} className="text-gray-300 dark:text-gray-600" />
              </div>
              <div className="px-2 pb-2">
                {debts.slice(0, 3).map(debt => {
                  const IconComp = getDynamicIcon(debt.icon || 'user')
                  const remaining = Number(debt.total_amount) - (debt.paid_amount || 0)
                  const daysUntilDue = debt.due_date ? differenceInDays(new Date(debt.due_date), today) : null
                  const isOverdue = daysUntilDue !== null && daysUntilDue < 0
                  return (
                    <div key={debt.id} onClick={() => router.push(`/debts/${debt.id}`)} className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${debt.color}15`, color: debt.color }}><IconComp size={20} /></div>
                        <div>
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100">{debt.person_name}</p>
                          <p className={`text-[12px] font-medium mt-0.5 ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                            {isOverdue ? `Atrasado ${Math.abs(daysUntilDue)} dia(s)` : debt.due_date ? `Vence ${format(new Date(debt.due_date), "dd/MM")}` : 'Sem prazo'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-bold text-emerald-600">{formatCurrency(remaining)}</p>
                        <div className="w-16 bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mt-1.5 ml-auto"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(debt.percent, 100)}%` }} /></div>
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
                  return (
                    <div key={budget.id} onClick={() => router.push(`/budgets/${budget.id}`)} className="flex items-center gap-4 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors border-b border-gray-50 dark:border-slate-700/50 last:border-0">
                      <div className="w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${budget.color}15`, color: budget.color }}><IconComp size={20} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100 truncate">{budget.name}</p>
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${budget.remaining < 0 ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : budget.percent >= 80 ? 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>{budget.remaining < 0 ? 'Estourado' : budget.percent >= 80 ? 'Atenção' : 'Seguro'}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden mb-1.5"><div className={`h-full rounded-full transition-all duration-500 ${budget.remaining < 0 ? 'bg-red-500' : budget.percent >= 80 ? 'bg-orange-500' : 'bg-teal-500'}`} style={{ width: `${Math.min(budget.percent, 100)}%` }} /></div>
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
                    return (
                      <div key={tx.id} onClick={() => router.push(`/transactions/${tx.id}`)} className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-[16px] transition-colors gap-3 ${index !== recentTransactions.length - 1 ? 'border-b border-gray-50 dark:border-slate-700/50' : ''}`}>
                        {isPending ? <div className="w-5 h-5 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0"><Clock size={12} className="text-orange-500" /></div> : <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center shrink-0"><Check size={12} className="text-emerald-500" /></div>}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0" style={{ backgroundColor: `${tx.categories?.color || '#94a3b8'}15`, color: tx.categories?.color || '#64748b' }}><IconComp size={18} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100 uppercase tracking-tight truncate">{tx.description || tx.categories?.name || (tx.type === 'income' ? 'Receita' : 'Despesa')}</p>
                            <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-0.5 truncate">{format(new Date(tx.date), "dd 'de' MMM", { locale: ptBR })} • {tx.categories?.name || 'Geral'}</p>
                          </div>
                        </div>
                        <p className={`text-[15px] font-bold whitespace-nowrap shrink-0 ${tx.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {tx.type === 'income' ? '+' : '-'}{hideBalance ? '••••' : formatCurrency(Number(tx.amount) || 0)}
                        </p>
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
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 dark:bg-slate-900 pb-28 font-sans relative px-4 pt-6 transition-colors duration-300">
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
        <ContextToggle />
        <div className="flex items-center gap-3">
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
        className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-700 border border-teal-100 dark:border-slate-700 shadow-sm transition-all"
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