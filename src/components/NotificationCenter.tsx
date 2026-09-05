// src/components/NotificationCenter.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Bell,
  CreditCard,
  Repeat,
  Target,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  ExternalLink
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
import { safeUpdate } from '@/lib/safeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import {
  clearAllNotifications,
  isNotificationRead,
} from '@/lib/notificationUtils'
import { useIsAdmin } from '@/hooks/useAdmin'

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
  severity?: 'critical' | 'warning' | 'info' | 'success'
  is_read?: boolean
  read?: boolean
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
  onReadChange?: ((unreadCount: number) => void) | (() => void)
}

function groupNotifications(notifs: Notification[]): NotificationGroup[] {
  const groups: Record<string, NotificationGroup> = {}

  notifs.forEach((n) => {
    const safeId = String(n.id || '')
    let key = safeId.split('-')[0] || safeId || crypto.randomUUID()

    if (n.route) key = n.route
    if (n.cardId || n.budgetId || n.financingId || n.debtId) key = safeId || key

    if (!groups[key]) {
      groups[key] = {
        key,
        title: n.title || 'Notificação',
        subtitle: n.subtitle || '',
        route: n.route || '',
        severity: n.severity || 'info',
        count: 0,
        items: []
      }
    }

    groups[key].count++
    groups[key].items.push(n)
  })

  return Object.values(groups)
}

export default function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  onReadChange
}: NotificationCenterProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { vibrate, success, error: errorHaptic } = useHapticFeedback()
  const { isAdmin } = useIsAdmin()

  const [localNotifs, setLocalNotifs] = useState<Notification[]>([])
  const [processing, setProcessing] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Evita hidratação incorreta
  useEffect(() => {
    setMounted(true)
  }, [])

  // Trava o scroll do body quando o modal abre
  useEffect(() => {
    if (!mounted) return
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen, mounted])

  // Sincroniza as notificações que vêm da prop
  useEffect(() => {
    setLocalNotifs(Array.isArray(notifications) ? notifications : [])
  }, [notifications])

  const emitReadChange = useCallback((unread: number) => {
    if (!onReadChange) return
    try {
      onReadChange(unread)
    } catch {
      try {
        ;(onReadChange as () => void)()
      } catch {}
    }
  }, [onReadChange])

  // Função robusta para marcar como lida no Dexie e na fila
  const markAsRead = useCallback(async (notifIds: string[]) => {
    if (!user?.id || processing || !Array.isArray(notifIds) || notifIds.length === 0) return

    setProcessing(true)

    try {
      for (const notifId of notifIds) {
        if (!notifId) continue

        const updateData = {
          is_read: true,
          read: true,
          updated_at: new Date().toISOString()
        }

        const result = await safeUpdate('notifications', notifId, updateData, user.id)
        if (!result.success) {
          throw new Error(result.error || 'Falha ao atualizar notificação')
        }
      }

      // Atualiza a interface otimisticamente (instantâneo)
      const updated = localNotifs.map((n) =>
        notifIds.includes(n.id) ? { ...n, is_read: true, read: true } : n
      )

      setLocalNotifs(updated)

      const unread = updated.filter((n) => !isNotificationRead(n)).length
      emitReadChange(unread)
    } catch (err: any) {
      console.error('Erro ao marcar como lida:', err)
      showToast(`Erro ao processar: ${err?.message || 'Erro desconhecido'}`, 'error')
    } finally {
      setProcessing(false)
    }
  }, [user?.id, processing, localNotifs, emitReadChange, showToast])

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return

    const unreadIds = localNotifs.filter((n) => !isNotificationRead(n)).map((n) => n.id)

    if (unreadIds.length > 0) {
      success()
      await markAsRead(unreadIds)
      showToast('Notificações marcadas como lidas!', 'success')
      vibrate([10])
    }
  }, [user?.id, localNotifs, markAsRead, showToast, success, vibrate])

  const activeNotifs = useMemo(
    () => localNotifs.filter((n) => !isNotificationRead(n)),
    [localNotifs]
  )

  const grouped = useMemo(
    () => groupNotifications(activeNotifs),
    [activeNotifs]
  )

  const unreadCount = activeNotifs.length
  const displayedGroups = grouped.slice(0, 5)
  const criticalCount = grouped.filter((g) => g.severity === 'critical').length
  const warningCount = grouped.filter((g) => g.severity === 'warning').length

  const handleClick = async (group: NotificationGroup) => {
    vibrate([5])

    const notifIds = group.items.map((n) => n.id).filter(Boolean)
    await markAsRead(notifIds)

    if (group.route) {
      router.push(group.route)
    } else if (group.items.length === 1) {
      const notif = group.items[0]

      if (notif.cardId) router.push(`/cards/details?id=${notif.cardId}`)
      else if (notif.budgetId) router.push(`/budgets/details?id=${notif.budgetId}`)
      else if (notif.financingId) router.push(`/financings/details?id=${notif.financingId}`)
      else if (notif.debtId) router.push(`/debts/details?id=${notif.debtId}`)
      else if (notif.subId) router.push('/subscriptions')
    }

    onClose()
  }

  const getIcon = (type: string) => {
    const safeType = String(type || '')
    if (safeType.includes('invoice')) return <CreditCard size={18} />
    if (safeType.includes('subscription')) return <Repeat size={18} />
    if (safeType.includes('budget')) return <Target size={18} />
    if (safeType.includes('pending_expense')) return <Clock size={18} />
    if (safeType.includes('pending_income')) return <CheckCircle size={18} />
    if (safeType.includes('financing')) return <AlertTriangle size={18} />
    if (safeType.includes('debt')) return <AlertTriangle size={18} />
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
      case 'critical': return 'bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20'
      case 'warning': return 'bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20'
      case 'info': return 'bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20'
      case 'success': return 'bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
      default: return 'bg-gray-50 dark:bg-slate-700/50 hover:bg-gray-100 dark:hover:bg-slate-700'
    }
  }

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 border border-white/20 dark:border-slate-700/50 pointer-events-auto max-h-[90vh] flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-[18px] bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
              <Bell size={22} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-[18px] text-gray-800 dark:text-gray-100 tracking-tight">Notificações</h3>
              <p className="text-[12px] font-medium text-gray-400 dark:text-gray-500">
                {unreadCount} não lida{unreadCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={processing}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-[11px] font-bold hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 active:scale-95"
              >
                <Check size={14} />
                Marcar todas
              </button>
            )}

            <button
              onClick={() => {
                vibrate([5])
                onClose()
              }}
              className="text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 p-2.5 rounded-full active:scale-95 transition-transform"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-shrink-0 grid grid-cols-2 gap-2 px-5 py-3 border-b border-gray-100 dark:border-slate-700/50 bg-gray-50/50 dark:bg-slate-800/50">
          <div className="text-center">
            <span className="text-[13px] font-black text-red-500">{criticalCount}</span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-0.5">Críticos</p>
          </div>
          <div className="text-center">
            <span className="text-[13px] font-black text-orange-500">{warningCount}</span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mt-0.5">Atenção</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-[24px] bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center mb-4">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <p className="font-bold text-[16px] text-gray-800 dark:text-gray-200">Tudo em dia!</p>
              <p className="text-[13px] font-medium text-gray-400 dark:text-gray-500 mt-1">Nenhum alerta no momento.</p>
            </div>
          ) : (
            displayedGroups.map((group) => (
              <button
                key={group.key}
                onClick={() => handleClick(group)}
                disabled={processing}
                className={`w-full flex items-center gap-4 p-4 rounded-[24px] transition-all active:scale-[0.98] ${getBgColor(group.severity)}`}
              >
                <div className="relative w-10 h-10 rounded-[14px] bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm shrink-0">
                  <span className={getIconColor(group.severity)}>
                    {getIcon(group.items[0]?.type || '')}
                  </span>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-purple-500 rounded-full border-2 border-white dark:border-slate-800" />
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[14px] font-bold text-gray-800 dark:text-gray-100 leading-tight">
                    {group.title}
                    {group.count > 1 && (
                      <span className="ml-1 text-[12px] font-medium text-gray-500">
                        ({group.count})
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {group.subtitle}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {group.count > 1 && (
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
                      +{group.count - 1}
                    </span>
                  )}
                  <ArrowRight size={16} className="text-gray-300 dark:text-gray-600 ml-1" />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex-shrink-0 p-3 border-t border-gray-100 dark:border-slate-700/50">
          <button
            onClick={() => {
              vibrate([10])
              router.push('/notifications')
              onClose()
            }}
            className="w-full flex items-center justify-center gap-2 p-3.5 text-purple-700 dark:text-purple-400 bg-purple-50/50 hover:bg-purple-50 dark:bg-purple-900/10 dark:hover:bg-purple-900/20 rounded-[24px] transition-colors font-bold text-[14px] active:scale-[0.98]"
          >
            <ExternalLink size={16} />
            Ver Central Completa
            {grouped.length > 5 && (
              <span className="text-[11px] font-bold bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">
                +{grouped.length - 5}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}