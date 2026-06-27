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
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [deleteTimer, setDeleteTimer] = useState<NodeJS.Timeout | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [backupNotifs, setBackupNotifs] = useState<Notification[]>([])

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: reads } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', user.id)

    const readSet = new Set(reads?.map(r => r.notification_id) || [])
    setReadIds(readSet)

    const { count: archCount } = await supabase
      .from('notification_archives')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    setArchivedCount(archCount || 0)

    const today = new Date()
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

    cards?.forEach(card => {
      const days = (card.due_day || 1) - today.getDate()
      if (days < 0) {
        notifs.push({ id: `invoice-overdue-${card.id}`, type: 'invoice_overdue', title: `Fatura vencida: ${card.name}`, subtitle: `Venceu dia ${card.due_day}`, cardId: card.id, severity: 'critical', isRead: readSet.has(`invoice-overdue-${card.id}`) })
      } else if (days <= 3) {
        notifs.push({ id: `invoice-soon-${card.id}`, type: 'invoice_soon', title: `Fatura próxima: ${card.name}`, subtitle: `Vence em ${days} dia(s)`, cardId: card.id, severity: 'warning', isRead: readSet.has(`invoice-soon-${card.id}`) })
      }
    })

    subs?.forEach(sub => {
      const days = (sub.due_day || 1) - today.getDate()
      if (days < 0) {
        notifs.push({ id: `sub-overdue-${sub.id}`, type: 'subscription_overdue', title: `Assinatura vencida: ${sub.name}`, subtitle: `Venceu dia ${sub.due_day}`, subId: sub.id, severity: 'critical', isRead: readSet.has(`sub-overdue-${sub.id}`) })
      } else if (days <= 5) {
        notifs.push({ id: `sub-soon-${sub.id}`, type: 'subscription_soon', title: `Assinatura próxima: ${sub.name}`, subtitle: `Vence em ${days} dia(s)`, subId: sub.id, severity: 'warning', isRead: readSet.has(`sub-soon-${sub.id}`) })
      }
    })

    financings?.forEach(fin => {
      if (!fin.next_due_date) return
      const daysUntilDue = differenceInDays(new Date(fin.next_due_date), today)
      if (daysUntilDue < 0) {
        notifs.push({ id: `financing-overdue-${fin.id}`, type: 'financing_overdue', title: `Parcela vencida: ${fin.name}`, subtitle: `Venceu ${format(new Date(fin.next_due_date), "dd/MM")}`, financingId: fin.id, severity: 'critical', isRead: readSet.has(`financing-overdue-${fin.id}`) })
      } else if (daysUntilDue <= 3) {
        notifs.push({ id: `financing-soon-${fin.id}`, type: 'financing_soon', title: `Parcela próxima: ${fin.name}`, subtitle: `Vence em ${daysUntilDue} dia(s)`, financingId: fin.id, severity: 'warning', isRead: readSet.has(`financing-soon-${fin.id}`) })
      }
    })

    debtsData?.forEach(debt => {
      if (!debt.due_date) return
      const daysUntilDue = differenceInDays(new Date(debt.due_date), today)
      const remaining = Number(debt.total_amount) - (debt.paid_amount || 0)
      if (daysUntilDue < 0) {
        notifs.push({ id: `debt-overdue-${debt.id}`, type: 'debt_overdue', title: `Dívida vencida: ${debt.person_name}`, subtitle: `Venceu ${format(new Date(debt.due_date), "dd/MM")} — R$ ${remaining.toFixed(2)}`, debtId: debt.id, severity: 'critical', isRead: readSet.has(`debt-overdue-${debt.id}`) })
      } else if (daysUntilDue <= 3) {
        notifs.push({ id: `debt-soon-${debt.id}`, type: 'debt_soon', title: `Dívida próxima: ${debt.person_name}`, subtitle: `Vence em ${daysUntilDue} dia(s) — R$ ${remaining.toFixed(2)}`, debtId: debt.id, severity: 'warning', isRead: readSet.has(`debt-soon-${debt.id}`) })
      }
    })

    budgets?.forEach(budget => {
      const spent = transactions?.filter(t => t.category_id === budget.category_id && (t.type === 'expense' || t.type === 'sangria') && t.status === 'done').reduce((a, t) => a + (Number(t.amount) || 0), 0) || 0
      const remaining = Number(budget.amount) - spent
      if (remaining < 0) {
        notifs.push({ id: `budget-over-${budget.id}`, type: 'budget_over', title: `Orçamento estourado: ${budget.name || budget.categories?.name}`, subtitle: `Gasto R$ ${spent.toFixed(2)} de R$ ${Number(budget.amount).toFixed(2)}`, budgetId: budget.id, severity: 'critical', isRead: readSet.has(`budget-over-${budget.id}`) })
      } else if (Number(budget.amount) > 0 && (spent / Number(budget.amount)) * 100 >= 80) {
        notifs.push({ id: `budget-warn-${budget.id}`, type: 'budget_warning', title: `Orçamento quase lá: ${budget.name || budget.categories?.name}`, subtitle: `${((spent / Number(budget.amount)) * 100).toFixed(0)}% utilizado`, budgetId: budget.id, severity: 'warning', isRead: readSet.has(`budget-warn-${budget.id}`) })
      }
    })

    const pendingExpenses = transactions?.filter(t => t.status === 'pending' && (t.type === 'expense' || t.type === 'sangria')) || []
    if (pendingExpenses.length > 0) {
      notifs.push({ id: 'pending-expenses', type: 'pending_expense', title: `${pendingExpenses.length} despesa(s) pendente(s)`, subtitle: `Total: R$ ${pendingExpenses.reduce((a, t) => a + (Number(t.amount) || 0), 0).toFixed(2)}`, route: '/transactions?filter=expense&status=pending', severity: 'info', isRead: readSet.has('pending-expenses') })
    }

    const pendingIncomes = transactions?.filter(t => t.status === 'pending' && t.type === 'income') || []
    if (pendingIncomes.length > 0) {
      notifs.push({ id: 'pending-incomes', type: 'pending_income', title: `${pendingIncomes.length} receita(s) a receber`, subtitle: `Total: R$ ${pendingIncomes.reduce((a, t) => a + (Number(t.amount) || 0), 0).toFixed(2)}`, route: '/transactions?filter=income&status=pending', severity: 'success', isRead: readSet.has('pending-incomes') })
    }

    setNotifications(notifs)
    setLoading(false)
  }, [user, context])

  useEffect(() => { loadData() }, [loadData])

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'archived') return false 
    switch (activeFilter) {
      case 'critical': return n.severity === 'critical'
      case 'warning': return n.severity === 'warning'
      case 'info': return n.severity === 'info' || n.severity === 'success'
      case 'unread': return !n.isRead
      default: return true
    }
  })

  const unreadCount = notifications.filter(n => !n.isRead).length

  const handleNotificationClick = async (notif: Notification) => {
    if (notif.isRead) return 

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

    if (notif.route) router.push(notif.route)
    else if (notif.cardId) router.push(`/cards/${notif.cardId}`)
    else if (notif.budgetId) router.push(`/budgets/${notif.budgetId}`)
    else if (notif.financingId) router.push(`/financings/${notif.financingId}`)
    else if (notif.debtId) router.push(`/debts/${notif.debtId}`)
    else if (notif.subId) router.push('/subscriptions')
  }

  const handleDelete = (notifId: string) => {
    setBackupNotifs([...notifications]) // Guarda backup
    setNotifications(prev => prev.filter(n => n.id !== notifId))
    showUndoBanner(notifId)
  }

  const handleDeleteAll = () => {
    setBackupNotifs([...notifications])
    setNotifications([])
    showUndoBanner('all')
  }

  const showUndoBanner = (id: string) => {
    setPendingDelete(id)
    if (deleteTimer) clearTimeout(deleteTimer)
    const timer = setTimeout(() => {
      setPendingDelete(null)
      setBackupNotifs([]) // Esvazia backup passado o tempo
    }, 3000)
    setDeleteTimer(timer)
  }

  const handleUndoDelete = () => {
    if (deleteTimer) clearTimeout(deleteTimer)
    setPendingDelete(null)
    setNotifications([...backupNotifs]) // Restaura backup instantaneamente
    setBackupNotifs([])
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
      await supabase.from('notification_reads').delete().match({ user_id: user!.id, notification_id: notif.id })
      setReadIds(prev => { const n = new Set(prev); n.delete(notif.id); return n })
    } else {
      await supabase.from('notification_reads').upsert({ user_id: user!.id, notification_id: notif.id, read_at: new Date().toISOString() }, { onConflict: 'user_id,notification_id' })
      setReadIds(prev => { const next = new Set(prev); next.add(notif.id); return next })
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

  const getThemeVars = (severity: string) => {
    switch (severity) {
      case 'critical': return { icon: 'text-red-500', bg: 'bg-red-50 dark:bg-red-500/10' }
      case 'warning': return { icon: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' }
      case 'info': return { icon: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' }
      case 'success': return { icon: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' }
      default: return { icon: 'text-gray-400', bg: 'bg-gray-100 dark:bg-slate-700' }
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
    <div className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-24 font-sans transition-colors duration-300 relative">
      
      {/* Banner Flutuante de Desfazer Exclusão (Animação de 3s) */}
      {pendingDelete && (
        <div className="fixed top-20 left-4 right-4 z-50 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-5 py-4 rounded-[20px] shadow-2xl flex items-center justify-between animate-in slide-in-from-top-5 fade-in duration-300">
          <span className="font-bold text-[14px]">
            {pendingDelete === 'all' ? 'Todas as notificações excluídas' : 'Notificação excluída'}
          </span>
          <button 
            onClick={handleUndoDelete}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/20 dark:bg-black/10 rounded-xl font-bold text-[13px] hover:bg-white/30 dark:hover:bg-black/20 transition-colors"
          >
            <RotateCcw size={16} /> Desfazer
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#f8f9fa] dark:bg-slate-900 px-4 pt-6 pb-2 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200">
            <ChevronLeft size={24} />
          </button>
          <h1 className="font-bold text-[18px] text-gray-800 dark:text-gray-100 tracking-tight">Central de Alertas</h1>
          <div className="flex items-center gap-1">
            <button onClick={handleArchiveAll} className="p-2 text-gray-400 dark:text-gray-500 hover:text-teal-700 transition-colors bg-white dark:bg-slate-800 rounded-full shadow-sm">
              <Archive size={18} />
            </button>
            <button onClick={handleDeleteAll} className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-colors bg-white dark:bg-slate-800 rounded-full shadow-sm">
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Filtros Premium */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`px-5 py-2.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all border ${
                activeFilter === f.key
                  ? 'bg-teal-700 text-white border-teal-700 shadow-md'
                  : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Estatísticas */}
      <div className="px-5 pb-3 flex items-center justify-between mt-2">
        <p className="text-[12px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">
          {filteredNotifications.length} alerta{filteredNotifications.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-4 text-[12px]">
          <span className="flex items-center gap-1.5 text-red-500 font-bold bg-red-50 dark:bg-red-500/10 px-2 py-1 rounded-md">
            <AlertTriangle size={14} /> {notifications.filter(n => n.severity === 'critical').length}
          </span>
          <span className="flex items-center gap-1.5 text-orange-500 font-bold bg-orange-50 dark:bg-orange-500/10 px-2 py-1 rounded-md">
            <Clock size={14} /> {notifications.filter(n => n.severity === 'warning').length}
          </span>
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 mt-2 space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-[24px] bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <p className="font-bold text-[18px] text-gray-800 dark:text-gray-200">Tudo sob controlo!</p>
            <p className="text-[14px] font-medium text-gray-400 dark:text-gray-500 mt-1">
              {activeFilter !== 'all' ? 'Sem alertas nesta categoria.' : 'Não existem notificações pendentes.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map(notif => {
            const theme = getThemeVars(notif.severity)
            return (
              <div
                key={notif.id}
                className={`bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-sm border border-gray-50 dark:border-slate-700 transition-all group ${
                  notif.isRead ? 'opacity-60 bg-gray-50/50 dark:bg-slate-800/50' : 'hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Ícone */}
                  <button
                    onClick={() => handleNotificationClick(notif)}
                    className={`relative w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0 ${theme.bg}`}
                  >
                    <span className={theme.icon}>
                      {getIcon(notif.type)}
                    </span>
                    {!notif.isRead && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-[3px] border-white dark:border-slate-800" />
                    )}
                  </button>

                  {/* Conteúdo */}
                  <button
                    onClick={() => handleNotificationClick(notif)}
                    className="flex-1 min-w-0 text-left py-1"
                  >
                    <p className="text-[15px] font-bold text-gray-800 dark:text-gray-100 leading-tight">
                      {notif.title}
                    </p>
                    <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-1 truncate">
                      {notif.subtitle}
                    </p>
                  </button>

                  {/* Ações Visíveis Apenas ao Lado */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleToggleRead(notif)}
                      className="p-2 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-700 hover:text-teal-600 hover:bg-teal-50 dark:hover:text-teal-400 rounded-full transition-colors"
                      title={notif.isRead ? 'Desmarcar' : 'Ler'}
                    >
                      {notif.isRead ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => handleDelete(notif.id)}
                      className="p-2 text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 rounded-full transition-colors"
                      title="Apagar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
