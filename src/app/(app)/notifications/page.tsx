'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { useContext_ } from '@/components/ContextToggle'
import {
  ChevronLeft, Bell, CreditCard, Repeat, Target, Clock, CheckCircle,
  AlertTriangle, Trash2, Archive, Check, X, Loader2, Search, Filter,
  RotateCcw, Eye, EyeOff
} from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'

interface Notification {
  id: string
  type: string
  title: string
  subtitle: string
  cardId?: string
  budgetId?: string
  txId?: string
  subId?: string
  financingId?: string
  debtId?: string
  route?: string
  severity: 'critical' | 'warning' | 'info' | 'success'
  isRead: boolean
}

type FilterType = 'all' | 'critical' | 'warning' | 'info' | 'unread'
type TabType = 'active' | 'archived'

export default function NotificationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [archivedCount, setArchivedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [activeTab, setActiveTab] = useState<TabType>('active')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [deleteTimer, setDeleteTimer] = useState<NodeJS.Timeout | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    // Carrega notificações lidas
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', user.id)

    const readSet = new Set(reads?.map(r => r.notification_id) || [])
    setReadIds(readSet)

    // Carrega arquivadas
    const { count: archCount } = await supabase
      .from('notification_archives')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    setArchivedCount(archCount || 0)

    // Busca dados reais para gerar notificações
    const today = new Date()
    const todayStr = format(today, 'yyyy-MM-dd')
    const startOfMonth = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd')
    const endOfMonth = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd')

    const [{ data: transactions }, { data: subs }, { data: debtsData }, { data: financings }, { data: budgets }, { data: cards }] = await Promise.all([
      supabase.from('transactions').select('*, categories(name, icon, color)').match({ user_id: user.id, context }).gte('date', startOfMonth).lte('date', endOfMonth).order('date', { ascending: false }),
      supabase.from('subscriptions').select('*').match({ user_id: user.id, context, status: 'active' }),
      supabase.from('debts').select('*').match({ user_id: user.id, context }).in('status', ['pending', 'partial']),
      supabase.from('financings').select('*').match({ user_id: user.id, context, status: 'active' }),
      supabase.from('budgets').select('*, categories(name, icon, color)').match({ user_id: user.id, context }),
      supabase.from('credit_cards').select('*').match({ user_id: user.id, context, is_archived: false })
    ])

    const notifs: Notification[] = []

    // Cartões
    cards?.forEach(card => {
      const days = (card.due_day || 1) - today.getDate()
      if (days < 0) {
        notifs.push({
          id: `invoice-overdue-${card.id}`,
          type: 'invoice_overdue',
          title: `Fatura vencida: ${card.name}`,
          subtitle: `Venceu dia ${card.due_day}`,
          cardId: card.id,
          severity: 'critical',
          isRead: readSet.has(`invoice-overdue-${card.id}`)
        })
      } else if (days <= 3) {
        notifs.push({
          id: `invoice-soon-${card.id}`,
          type: 'invoice_soon',
          title: `Fatura próxima: ${card.name}`,
          subtitle: `Vence em ${days} dia(s)`,
          cardId: card.id,
          severity: 'warning',
          isRead: readSet.has(`invoice-soon-${card.id}`)
        })
      }
    })

    // Assinaturas
    subs?.forEach(sub => {
      const days = (sub.due_day || 1) - today.getDate()
      if (days < 0) {
        notifs.push({
          id: `sub-overdue-${sub.id}`,
          type: 'subscription_overdue',
          title: `Assinatura vencida: ${sub.name}`,
          subtitle: `Venceu dia ${sub.due_day}`,
          subId: sub.id,
          severity: 'critical',
          isRead: readSet.has(`sub-overdue-${sub.id}`)
        })
      } else if (days <= 5) {
        notifs.push({
          id: `sub-soon-${sub.id}`,
          type: 'subscription_soon',
          title: `Assinatura próxima: ${sub.name}`,
          subtitle: `Vence em ${days} dia(s)`,
          subId: sub.id,
          severity: 'warning',
          isRead: readSet.has(`sub-soon-${sub.id}`)
        })
      }
    })

    // Financiamentos
    financings?.forEach(fin => {
      if (!fin.next_due_date) return
      const daysUntilDue = differenceInDays(new Date(fin.next_due_date), today)
      if (daysUntilDue < 0) {
        notifs.push({
          id: `financing-overdue-${fin.id}`,
          type: 'financing_overdue',
          title: `Parcela vencida: ${fin.name}`,
          subtitle: `Venceu ${format(new Date(fin.next_due_date), "dd/MM")}`,
          financingId: fin.id,
          severity: 'critical',
          isRead: readSet.has(`financing-overdue-${fin.id}`)
        })
      } else if (daysUntilDue <= 3) {
        notifs.push({
          id: `financing-soon-${fin.id}`,
          type: 'financing_soon',
          title: `Parcela próxima: ${fin.name}`,
          subtitle: `Vence em ${daysUntilDue} dia(s)`,
          financingId: fin.id,
          severity: 'warning',
          isRead: readSet.has(`financing-soon-${fin.id}`)
        })
      }
    })

    // Dívidas
    debtsData?.forEach(debt => {
      if (!debt.due_date) return
      const daysUntilDue = differenceInDays(new Date(debt.due_date), today)
      const remaining = Number(debt.total_amount) - (debt.paid_amount || 0)
      if (daysUntilDue < 0) {
        notifs.push({
          id: `debt-overdue-${debt.id}`,
          type: 'debt_overdue',
          title: `Dívida vencida: ${debt.person_name}`,
          subtitle: `Venceu ${format(new Date(debt.due_date), "dd/MM")} — R$ ${remaining.toFixed(2)}`,
          debtId: debt.id,
          severity: 'critical',
          isRead: readSet.has(`debt-overdue-${debt.id}`)
        })
      } else if (daysUntilDue <= 3) {
        notifs.push({
          id: `debt-soon-${debt.id}`,
          type: 'debt_soon',
          title: `Dívida próxima: ${debt.person_name}`,
          subtitle: `Vence em ${daysUntilDue} dia(s) — R$ ${remaining.toFixed(2)}`,
          debtId: debt.id,
          severity: 'warning',
          isRead: readSet.has(`debt-soon-${debt.id}`)
        })
      }
    })

    // Orçamentos
    budgets?.forEach(budget => {
      const spent = transactions?.filter(t => t.category_id === budget.category_id && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0) || 0
      const remaining = Number(budget.amount) - spent
      if (remaining < 0) {
        notifs.push({
          id: `budget-over-${budget.id}`,
          type: 'budget_over',
          title: `Orçamento estourado: ${budget.name || budget.categories?.name}`,
          subtitle: `Gasto R$ ${spent.toFixed(2)} de R$ ${Number(budget.amount).toFixed(2)}`,
          budgetId: budget.id,
          severity: 'critical',
          isRead: readSet.has(`budget-over-${budget.id}`)
        })
      } else if (Number(budget.amount) > 0 && (spent / Number(budget.amount)) * 100 >= 80) {
        notifs.push({
          id: `budget-warn-${budget.id}`,
          type: 'budget_warning',
          title: `Orçamento quase lá: ${budget.name || budget.categories?.name}`,
          subtitle: `${((spent / Number(budget.amount)) * 100).toFixed(0)}% utilizado`,
          budgetId: budget.id,
          severity: 'warning',
          isRead: readSet.has(`budget-warn-${budget.id}`)
        })
      }
    })

    // Despesas pendentes
    const pendingExpenses = transactions?.filter(t => t.status === 'pending' && (t.type === 'expense' || t.type === 'sangria')) || []
    if (pendingExpenses.length > 0) {
      notifs.push({
        id: 'pending-expenses',
        type: 'pending_expense',
        title: `${pendingExpenses.length} despesa(s) pendente(s)`,
        subtitle: `Total: R$ ${pendingExpenses.reduce((a, t) => a + (Number(t.amount) || 0), 0).toFixed(2)}`,
        route: '/transactions?filter=expense&status=pending',
        severity: 'info',
        isRead: readSet.has('pending-expenses')
      })
    }

    // Receitas pendentes
    const pendingIncomes = transactions?.filter(t => t.status === 'pending' && t.type === 'income') || []
    if (pendingIncomes.length > 0) {
      notifs.push({
        id: 'pending-incomes',
        type: 'pending_income',
        title: `${pendingIncomes.length} receita(s) a receber`,
        subtitle: `Total: R$ ${pendingIncomes.reduce((a, t) => a + (Number(t.amount) || 0), 0).toFixed(2)}`,
        route: '/transactions?filter=income&status=pending',
        severity: 'success',
        isRead: readSet.has('pending-incomes')
      })
    }

    setNotifications(notifs)
    setLoading(false)
  }, [user, context])

  useEffect(() => { loadData() }, [loadData])

  // Filtros
  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'archived') return false // Depois implementamos arquivamento
    switch (activeFilter) {
      case 'critical': return n.severity === 'critical'
      case 'warning': return n.severity === 'warning'
      case 'info': return n.severity === 'info' || n.severity === 'success'
      case 'unread': return !n.isRead
      default: return true
    }
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  // Ações
  const handleNotificationClick = async (notif: Notification) => {
    if (notif.isRead) return // Já lida → não faz nada

    // Marcar como lida
    await supabase.from('notification_reads').upsert({
      user_id: user!.id,
      notification_id: notif.id,
      read_at: new Date().toISOString()
    }, { onConflict: 'user_id,notification_id' })

     setReadIds(prev => {
      const next = new Set(prev)
      next.add(notif.id)
      return next
     })

    // Navegar
    if (notif.route) {
      router.push(notif.route)
    } else if (notif.cardId) {
      router.push(`/cards/${notif.cardId}`)
    } else if (notif.budgetId) {
      router.push(`/budgets/${notif.budgetId}`)
    } else if (notif.financingId) {
      router.push(`/financings/${notif.financingId}`)
    } else if (notif.debtId) {
      router.push(`/debts/${notif.debtId}`)
    } else if (notif.subId) {
      router.push('/subscriptions')
    }
  }

  const handleDelete = (notifId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notifId))
    showUndoToast(notifId)
  }

  const showUndoToast = (notifId: string) => {
    const notif = notifications.find(n => n.id === notifId)
    if (!notif) return

    setPendingDelete(notifId)
    showToast('Notifica\u00e7\u00e3o exclu\u00edda!', 'info')

    // Timer para desfazer (3 segundos)
    const timer = setTimeout(() => {
      setPendingDelete(null)
    }, 3000)
    setDeleteTimer(timer)
  }

  const handleUndoDelete = () => {
    if (deleteTimer) clearTimeout(deleteTimer)
    setPendingDelete(null)
    loadData() // Recarrega para restaurar
    showToast('Exclusão desfeita!', 'success')
  }

  const handleDeleteAll = () => {
    setNotifications([])
    showToast('Todas as notificações excluídas!', 'success')
  }

  const handleArchiveAll = async () => {
    if (!user) return
    const allIds = filteredNotifications.map(n => n.id)
    await supabase.from('notification_archives').insert({
      user_id: user.id,
      notification_ids: allIds
    })
    setNotifications(prev => prev.filter(n => !allIds.includes(n.id)))
    setArchivedCount(prev => prev + 1)
    showToast('Notificações arquivadas!', 'success')
  }

  const handleToggleRead = async (notif: Notification) => {
    if (notif.isRead) {
      // Desmarcar como lida
      await supabase.from('notification_reads').delete().match({ user_id: user!.id, notification_id: notif.id })
      setReadIds(prev => { const n = new Set(prev); n.delete(notif.id); return n })
      showToast('Marcada como não lida', 'info')
    } else {
      // Marcar como lida
      await supabase.from('notification_reads').upsert({ user_id: user!.id, notification_id: notif.id, read_at: new Date().toISOString() }, { onConflict: 'user_id,notification_id' })
      setReadIds(prev => {
        const next = new Set(prev)
        next.add(notif.id)
        return next
      })
      showToast('Marcada como lida', 'success')
    }
  }

  const getIcon = (type: string) => {
    if (type.includes('invoice')) return <CreditCard size={18} />
    if (type.includes('subscription')) return <Repeat size={18} />
    if (type.includes('budget')) return <Target size={18} />
    if (type.includes('pending_expense')) return <Clock size={18} />
    if (type.includes('pending_income')) return <CheckCircle size={18} />
    if (type.includes('financing')) return <AlertTriangle size={18} />
    if (type.includes('debt')) return <AlertTriangle size={18} />
    return <Bell size={18} />
  }

  const getIconColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500'
      case 'warning': return 'text-orange-500'
      case 'info': return 'text-blue-500'
      case 'success': return 'text-emerald-500'
      default: return 'text-gray-400'
    }
  }

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: 'unread', label: 'Não lidas' },
    { key: 'critical', label: 'Críticas' },
    { key: 'warning', label: 'Atenção' },
    { key: 'info', label: 'Informativas' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-900">
        <Loader2 className="animate-spin text-teal-700" size={40} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans transition-colors duration-300">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 sticky top-0 z-10 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-bold text-[17px] text-gray-800 dark:text-gray-100">Notificações</h1>
          <div className="flex items-center gap-2">
            {pendingDelete && (
              <button onClick={handleUndoDelete} className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full text-xs font-bold">
                <RotateCcw size={14} /> Desfazer
              </button>
            )}
            <button onClick={handleArchiveAll} className="p-2 text-gray-400 dark:text-gray-500 hover:text-teal-700">
              <Archive size={18} />
            </button>
            <button onClick={handleDeleteAll} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeFilter === f.key
                  ? 'bg-teal-700 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Estatísticas */}
      <div className="px-4 py-3 flex items-center justify-between">
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
          {filteredNotifications.length} notificação{filteredNotifications.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-red-500 font-bold">
            <AlertTriangle size={12} /> {notifications.filter(n => n.severity === 'critical').length}
          </span>
          <span className="flex items-center gap-1 text-orange-500 font-bold">
            <Clock size={12} /> {notifications.filter(n => n.severity === 'warning').length}
          </span>
          <span className="flex items-center gap-1 text-blue-500 font-bold">
            <Bell size={12} /> {unreadCount}
          </span>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 space-y-2">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
              <CheckCircle size={28} className="text-emerald-500" />
            </div>
            <p className="font-bold text-gray-800 dark:text-gray-200">Tudo em dia!</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {activeFilter !== 'all' ? 'Nenhuma notificação neste filtro.' : 'Nenhum alerta no momento.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notif => (
            <div
              key={notif.id}
              className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-50 dark:border-slate-700 transition-all ${
                notif.isRead ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Ícone */}
                <button
                  onClick={() => handleNotificationClick(notif)}
                  className="relative w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-700 flex items-center justify-center shadow-sm flex-shrink-0"
                >
                  <span className={getIconColor(notif.severity)}>
                    {getIcon(notif.type)}
                  </span>
                  {!notif.isRead && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full border-2 border-white dark:border-slate-800" />
                  )}
                </button>

                {/* Conteúdo */}
                <button
                  onClick={() => handleNotificationClick(notif)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                    {notif.title}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
                    {notif.subtitle}
                  </p>
                </button>

                {/* Ações */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleRead(notif)}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-teal-600 dark:hover:text-teal-400 rounded-full hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    title={notif.isRead ? 'Marcar como não lida' : 'Marcar como lida'}
                  >
                    {notif.isRead ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={() => handleDelete(notif.id)}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
