'use client'

import { useState, useEffect } from 'react'
import { X, Bell, CreditCard, Repeat, Target, Clock, CheckCircle, AlertTriangle, ArrowRight, Check, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { db, addToSyncQueue } from '@/lib/db' // 🔥 ADICIONADO addToSyncQueue
import { useToast } from '@/contexts/ToastContext'

interface Notification {
  id: string
  type: string
  title: string
  subtitle: string
  card_id?: string
  budget_id?: string
  tx_id?: string
  sub_id?: string
  financing_id?: string
  debt_id?: string
  route?: string
  severity: 'critical' | 'warning' | 'info' | 'success'
  is_read: boolean
  read?: boolean
  created_at: string
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
    if (n.card_id || n.budget_id || n.financing_id || n.debt_id) {
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
  const [localNotifs, setLocalNotifs] = useState<Notification[]>(notifications)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    setLocalNotifs(notifications)
  }, [notifications])

  // 🔥 CORRIGIDO: NÃO usa refreshFromDexie() para marcar como lida
  // Apenas atualiza o estado local

  // ============================================================
  // 🔥 CORRIGIDO: markAsRead SEM refreshFromDexie()
  // ============================================================
  const markAsRead = async (notifIds: string[]) => {
    if (!user || processing) return
    setProcessing(true)

    try {
      for (const notifId of notifIds) {
        const updateData = {
          is_read: true,
          read: true,
          updated_at: new Date().toISOString()
        }
        await db.table('notifications').update(notifId, updateData)
        await addToSyncQueue(user.id, 'notifications', 'update', notifId, updateData)
      }

      // 🔥 ATUALIZA O ESTADO LOCAL IMEDIATAMENTE
      const updated = localNotifs.map((n: any) => {
        if (notifIds.includes(n.id)) {
          return { ...n, is_read: true, read: true }
        }
        return n
      })
      setLocalNotifs(updated)

      const unread = updated.filter((n: any) => !n.is_read && !n.read).length
      if (onReadChange) onReadChange(unread)

      showToast(`${notifIds.length} notificação(ões) marcada(s) como lida(s)!`, 'success')
    } catch (err: any) {
      console.error('Erro ao marcar como lida:', err)
      showToast(`Erro: ${err.message}`, 'error')
    } finally {
      setProcessing(false)
    }
  }

  // ============================================================
  // 🔥 CORRIGIDO: markAllAsRead SEM refreshFromDexie()
  // ============================================================
  const markAllAsRead = async () => {
    if (!user || processing) return
    const allIds = localNotifs.map(n => n.id)
    await markAsRead(allIds)
  }

  // ============================================================
  // 🔥 CORRIGIDO: handleClose NÃO chama refreshFromDexie()
  // ============================================================
  const handleClose = () => {
    onClose()
  }

  if (!isOpen) return null

  const grouped = groupNotifications(localNotifs)
  const unreadCount = localNotifs.filter(n => !n.is_read && !n.read).length
  const displayedGroups = grouped.slice(0, 5)

  const handleClick = async (group: NotificationGroup) => {
    const notifIds = group.items.map(n => n.id)
    await markAsRead(notifIds)

    if (group.route) {
      router.push(group.route)
    } else if (group.items.length === 1) {
      const notif = group.items[0]
      if (notif.card_id) router.push(`/cards/${notif.card_id}`)
      else if (notif.budget_id) router.push(`/budgets/${notif.budget_id}`)
      else if (notif.financing_id) router.push(`/financings/${notif.financing_id}`)
      else if (notif.debt_id) router.push(`/debts/${notif.debt_id}`)
      else if (notif.sub_id) router.push('/subscriptions')
    }
  }

  const getIcon = (type: string) => {
    if (type.includes('invoice')) return <CreditCard size={20} />
    if (type.includes('subscription')) return <Repeat size={20} />
    if (type.includes('budget')) return <Target size={20} />
    if (type.includes('pending_expense')) return <Clock size={20} />
    if (type.includes('pending_income')) return <CheckCircle size={20} />
    if (type.includes('financing')) return <AlertTriangle size={20} />
    if (type.includes('debt')) return <AlertTriangle size={20} />
    return <Bell size={20} />
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

  const criticalCount = grouped.filter(g => g.severity === 'critical').length
  const warningCount = grouped.filter(g => g.severity === 'warning').length

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm transition-opacity" onClick={handleClose} />
      <div className="fixed inset-x-0 top-0 z-[110] mx-auto max-w-md pt-14 px-4 pointer-events-none">
        <div className="bg-white dark:bg-slate-800 rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300 pointer-events-auto border border-gray-100 dark:border-slate-700">
          
          <div className="flex items-center justify-between p-6 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[18px] bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                <Bell size={24} className="text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-bold text-[19px] text-gray-800 dark:text-gray-100 tracking-tight">Notificações</h3>
                <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 mt-0.5">
                  {unreadCount} alerta{unreadCount !== 1 ? 's' : ''} pendente{unreadCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  disabled={processing}
                  className="w-10 h-10 flex items-center justify-center bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors disabled:opacity-50"
                  title="Marcar todas como lidas"
                >
                  <Check size={18} />
                </button>
              )}
              <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex px-6 pb-4 gap-3">
            <div className="flex-1 bg-red-50 dark:bg-red-500/10 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[16px] font-bold text-red-600 dark:text-red-400">{criticalCount}</span>
              <span className="text-[10px] font-bold text-red-500/70 uppercase tracking-wider mt-0.5">Críticos</span>
            </div>
            <div className="flex-1 bg-orange-50 dark:bg-orange-500/10 rounded-2xl p-3 flex flex-col items-center justify-center">
              <span className="text-[16px] font-bold text-orange-600 dark:text-orange-400">{warningCount}</span>
              <span className="text-[10px] font-bold text-orange-500/70 uppercase tracking-wider mt-0.5">Atenção</span>
            </div>
          </div>

          <div className="max-h-[50vh] overflow-y-auto px-4 pb-2 space-y-2">
            {grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 rounded-[24px] bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                  <CheckCircle size={32} className="text-emerald-500" />
                </div>
                <p className="font-bold text-[17px] text-gray-800 dark:text-gray-200">Tudo em dia!</p>
                <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-1">O seu radar financeiro está limpo.</p>
              </div>
            ) : (
              displayedGroups.map(group => {
                const isRead = group.items.every(n => n.is_read || n.read)
                const theme = getThemeVars(group.severity)
                
                return (
                  <button
                    key={group.key}
                    onClick={() => handleClick(group)}
                    disabled={processing}
                    className={`w-full flex items-center gap-4 p-4 rounded-[24px] text-left transition-all ${isRead ? 'opacity-50 hover:opacity-80' : 'bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-md'} ${processing ? 'cursor-wait' : ''}`}
                  >
                    <div className={`relative w-12 h-12 rounded-[18px] flex items-center justify-center shrink-0 ${theme.bg}`}>
                      <span className={theme.icon}>{getIcon(group.items[0]?.type || '')}</span>
                      {!isRead && (
                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-[3px] border-white dark:border-slate-800" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100 leading-tight">
                        {group.title}
                      </p>
                      <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500 truncate mt-1">
                        {group.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {group.count > 1 && (
                        <span className="text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2.5 py-1 rounded-full">
                          +{group.count - 1}
                        </span>
                      )}
                      <ArrowRight size={18} className="text-gray-300 dark:text-gray-600" />
                    </div>
                  </button>
                )
              })
            )}
          </div>
          
          <div className="p-4 pt-2">
            <button
              onClick={() => {
                router.push('/notifications')
                handleClose()
              }}
              className="w-full flex items-center justify-center gap-2 p-4 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 rounded-[20px] transition-colors font-bold text-[14px]"
            >
              <ExternalLink size={18} />
              Ver Central de Notificações
            </button>
          </div>
        </div>
      </div>
    </>
  )
}