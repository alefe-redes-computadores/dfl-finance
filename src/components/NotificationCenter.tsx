'use client'

import { useState, useEffect } from 'react'
import { X, Bell, CreditCard, Repeat, Target, Clock, CheckCircle, AlertTriangle, ArrowRight, Check, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
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
}

interface NotificationGroup {
  key: string
  title: string
  subtitle: string
  route: string
  severity: 'critical' | 'warning' | 'info' | 'success'
  count: number
  items: Notification[]
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  onReadChange?: (unreadCount: number) => void
}

function groupNotifications(notifs: Notification[]): NotificationGroup[] {
  const groups: Record<string, NotificationGroup> = {}

  notifs.forEach(n => {
    let key = n.id.split('-')[0]
    
    if (n.route) {
      key = n.route
    }
    if (n.cardId || n.budgetId || n.financingId || n.debtId) {
      key = n.id
    }

    if (!groups[key]) {
      groups[key] = {
        key,
        title: n.title,
        subtitle: n.subtitle,
        route: n.route || '',
        severity: n.severity,
        count: 0,
        items: []
      }
    }
    groups[key].count++
    groups[key].items.push(n)
  })

  return Object.values(groups)
}

export default function NotificationCenter({ isOpen, onClose, notifications, onReadChange }: NotificationCenterProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [readIds, setReadIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen && user) {
      loadReadNotifications()
    }
  }, [isOpen, user])

  const loadReadNotifications = async () => {
    if (!user) return
    const { data } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', user.id)
    
    if (data) {
      setReadIds(new Set(data.map(d => d.notification_id)))
    }
  }

  const markAsRead = async (notifIds: string[]) => {
    if (!user) return
    
    const newRead = new Set(readIds)
    notifIds.forEach(id => newRead.add(id))
    setReadIds(newRead)

    for (const notifId of notifIds) {
      await supabase
        .from('notification_reads')
        .upsert({
          user_id: user.id,
          notification_id: notifId,
          read_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,notification_id'
        })
    }

    const unread = notifications.filter(n => !newRead.has(n.id)).length
    onReadChange?.(unread)
  }

  const markAllAsRead = async () => {
    if (!user) return
    const allIds = notifications.map(n => n.id)
    await markAsRead(allIds)
    showToast('Notificações marcadas como lidas!', 'success')
  }

  if (!isOpen) return null

  const grouped = groupNotifications(notifications)
  const unreadCount = notifications.filter(n => !readIds.has(n.id)).length
  
  const displayedGroups = grouped.slice(0, 5)
  const hasMore = grouped.length > 5

  const handleClick = async (group: NotificationGroup) => {
    const notifIds = group.items.map(n => n.id)
    await markAsRead(notifIds)

    if (group.route) {
      router.push(group.route)
    } else if (group.items.length === 1) {
      const notif = group.items[0]
      if (notif.cardId) router.push(`/cards/${notif.cardId}`)
      else if (notif.budgetId) router.push(`/budgets/${notif.budgetId}`)
      else if (notif.financingId) router.push(`/financings/${notif.financingId}`)
      else if (notif.debtId) router.push(`/debts/${notif.debtId}`)
      else if (notif.subId) router.push('/subscriptions')
    }
    
    onClose()
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

  const getBgColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 dark:bg-red-900/20'
      case 'warning': return 'bg-orange-50 dark:bg-orange-900/20'
      case 'info': return 'bg-blue-50 dark:bg-blue-900/20'
      case 'success': return 'bg-emerald-50 dark:bg-emerald-900/20'
      default: return 'bg-gray-50 dark:bg-slate-700'
    }
  }

  const criticalCount = grouped.filter(g => g.severity === 'critical').length
  const warningCount = grouped.filter(g => g.severity === 'warning').length

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-50 mx-auto max-w-md pt-16 px-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center justify-between p-5 border-b border-gray-50 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                <Bell size={20} className="text-teal-700 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">Notificações</h3>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full text-xs font-bold hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                >
                  <Check size={14} />
                  Marcar todas
                </button>
              )}
              <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2 rounded-full">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 px-5 py-3 border-b border-gray-50 dark:border-slate-700">
            <div className="text-center">
              <span className="text-[11px] font-bold text-red-500">{criticalCount}</span>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Críticos</p>
            </div>
            <div className="text-center">
              <span className="text-[11px] font-bold text-orange-500">{warningCount}</span>
              <p className="text-[9px] text-gray-400 dark:text-gray-500">Atenção</p>
            </div>
          </div>

          <div className="max-h-[50vh] overflow-y-auto">
            {grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-3">
                  <CheckCircle size={28} className="text-emerald-500" />
                </div>
                <p className="font-bold text-gray-800 dark:text-gray-200">Tudo em dia!</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Nenhum alerta no momento.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-slate-700">
                {displayedGroups.map(group => {
                  const isRead = group.items.every(n => readIds.has(n.id))
                  
                  return (
                    <button
                      key={group.key}
                      onClick={() => handleClick(group)}
                      className={`w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${getBgColor(group.severity)} ${isRead ? 'opacity-60' : ''}`}
                    >
                      <div className="relative w-9 h-9 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center shadow-sm">
                        <span className={getIconColor(group.severity)}>
                          {getIcon(group.items[0]?.type || '')}
                        </span>
                        {!isRead && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-teal-500 rounded-full border-2 border-white dark:border-slate-700" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-800 dark:text-gray-200">
                          {group.title}
                          {group.count > 1 && (
                            <span className="ml-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                              ({group.count})
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{group.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {group.count > 1 && (
                          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">
                            +{group.count - 1}
                          </span>
                        )}
                        <ArrowRight size={16} className="text-gray-300 dark:text-gray-600" />
                      </div>
                    </button>
                  )
                })}
                
                <button
                  onClick={() => {
                    router.push('/notifications')
                    onClose()
                  }}
                  className="w-full flex items-center justify-center gap-2 px-5 py-4 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors font-bold text-sm border-t border-gray-50 dark:border-slate-700"
                >
                  <ExternalLink size={16} />
                  Ver Central de Notificações
                  {grouped.length > 0 && (
                    <span className="text-[10px] bg-teal-100 dark:bg-teal-900/30 px-2 py-0.5 rounded-full">
                      {grouped.length}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}