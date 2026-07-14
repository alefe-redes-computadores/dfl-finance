'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  ChevronLeft, Bell, Check, X, RefreshCw,
  AlertTriangle, Info, CheckCircle, Trash2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { useSafeDb } from '@/hooks/useSafeDb'
import { useHapticFeedback } from '@/hooks/useHapticFeedback'
import { clearAllNotifications } from '@/lib/notificationUtils'
import { useIsAdmin } from '@/hooks/useAdmin'

// 🔥 SKELETON ATUALIZADO
const NotificationsSkeleton = () => (
  <div className="space-y-2.5 animate-pulse">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[24px] border border-gray-200/70 dark:border-slate-700 shadow-sm p-2">
        <div className="rounded-[18px] p-3 flex items-start gap-3">
          <div className="w-10 h-10 rounded-[14px] bg-gray-200 dark:bg-slate-700 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
            <div className="h-3 w-1/2 bg-gray-100 dark:bg-slate-700/50 rounded" />
            <div className="h-3 w-24 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export default function NotificationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { success: hapticSuccess, error: hapticError, vibrate } = useHapticFeedback()
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  
  const { safeDelete, safeUpdate } = useSafeDb()
  
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all')
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [processing, setProcessing] = useState(false)

  const { data: localNotifications, reload: reloadNotifications } = useLocalData({
    table: 'notifications' as any,
    filters: { user_id: user?.id },
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const pullStartY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = (e: TouchEvent) => {
    if (window.scrollY > 10 || loading) return
    pullStartY.current = e.touches[0].clientY
    isPulling.current = true
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling.current || refreshing) return
    const pullDistance = e.touches[0].clientY - pullStartY.current
    if (pullDistance > 60) {
      setRefreshing(true)
      isPulling.current = false
      loadNotifications().finally(() => {
        setTimeout(() => setRefreshing(false), 400)
      })
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
  }, [loading, refreshing])

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    try {
      await reloadNotifications()
    } catch (err) {
      console.error('Erro ao carregar notificações:', err)
    } finally {
      setLoading(false)
      setLoadingPulse(false)
    }
  }, [user?.id, reloadNotifications])

  useEffect(() => {
    if (user?.id) {
      loadNotifications()
    }
  }, [user?.id, loadNotifications])

  useEffect(() => {
    if (localNotifications) {
      const mapped = localNotifications.map((n: any) => ({
        ...n,
        is_read: n.is_read || n.read || false,
        read: n.is_read || n.read || false,
      }))
      setNotifications(mapped)
      const unread = mapped.filter((n: any) => !n.is_read).length
      setUnreadCount(unread)
    }
  }, [localNotifications])

  const markAsRead = useCallback(async (id: string) => {
    if (!user) return
    try {
      const updatedList = notifications.map((n: any) => 
        n.id === id ? { ...n, is_read: true, read: true } : n
      )
      setNotifications(updatedList)
      setUnreadCount(updatedList.filter((n: any) => !n.is_read).length)

      const updateData = { is_read: true, read: true, updated_at: new Date().toISOString() }
      const result = await safeUpdate('notifications', id, updateData)
      
      if (!result.success) {
        throw new Error(result.error)
      }
      
      vibrate([10])
      hapticSuccess()
    } catch (err: any) {
      console.error('Erro ao marcar como lida:', err)
      hapticError()
      await loadNotifications()
    }
  }, [user, notifications, safeUpdate, loadNotifications, vibrate, hapticSuccess, hapticError])

  const markAllAsRead = useCallback(async () => {
    if (!user?.id || notifications.length === 0) return

    try {
      const unread = notifications.filter((n: any) => !n.is_read)
      
      const updatedList = notifications.map((n: any) => ({ ...n, is_read: true, read: true }))
      setNotifications(updatedList)
      setUnreadCount(0)

      for (const notif of unread) {
        const updateData = { is_read: true, read: true, updated_at: new Date().toISOString() }
        const result = await safeUpdate('notifications', notif.id, updateData)
        if (!result.success) {
          throw new Error(result.error)
        }
      }
      
      hapticSuccess()
      vibrate([20, 10])
      showToast('✅ Todas as notificações marcadas como lidas!', 'success')
    } catch (err: any) {
      console.error('Erro:', err)
      hapticError()
      await loadNotifications()
    }
  }, [user, notifications, safeUpdate, loadNotifications, showToast, hapticSuccess, hapticError, vibrate])

  const handleClearAll = useCallback(async () => {
    if (!user?.id) return
    
    if (!isAdmin) {
      showToast('⚠️ Apenas administradores podem limpar todas as notificações.', 'warning')
      return
    }

    if (!confirm('⚠️ Tem certeza que deseja limpar TODAS as notificações? Esta ação não pode ser desfeita.')) return

    setProcessing(true)
    try {
      const result = await clearAllNotifications(user.id)
      if (!result.success) {
        throw new Error(result.error)
      }
      
      setNotifications([])
      setUnreadCount(0)
      
      hapticSuccess()
      vibrate([20, 10])
      showToast('🗑️ Todas as notificações foram removidas!', 'success')
    } catch (err: any) {
      hapticError()
      showToast(`❌ Erro ao limpar notificações: ${err.message}`, 'error')
    } finally {
      setProcessing(false)
    }
  }, [user, isAdmin, showToast, hapticSuccess, hapticError, vibrate])

  // Adicione isto dentro do deleteNotification
    const deleteNotification = useCallback(async (id: string) => {
      if (!user) return
      try {
      // 1. Atualização Otimista
      const filteredList = notifications.filter(n => n.id !== id)
      setNotifications(filteredList)
      setUnreadCount(filteredList.filter((n: any) => !n.is_read).length)

      // 2. Remoção Real do DB
      const result = await safeDelete('notifications', id)
      
      if (!result.success) throw new Error(result.error)
      
      // 🔥 MATADOR DE ZUMBI: Se houver Service Worker, avisamos ele aqui
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready
        // Isso limpa tags de notificações pendentes ligadas a esse ID
        registration.getNotifications({ tag: id }).then(nots => {
          nots.forEach(n => n.close())
        })
      }
      
      hapticSuccess()
      vibrate([10])
    } catch (err: any) {
      console.error('Erro ao deletar:', err)
      hapticError()
      await loadNotifications()
    }
  }, [user, notifications, safeDelete, loadNotifications, hapticSuccess, hapticError, vibrate])


  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle size={18} className="text-red-500" />
      case 'warning': return <Info size={18} className="text-orange-500" />
      case 'success': return <CheckCircle size={18} className="text-emerald-500" />
      default: return <Info size={18} className="text-blue-500" />
    }
  }

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 dark:bg-red-900/20'
      case 'warning': return 'bg-orange-50 dark:bg-orange-900/20'
      case 'success': return 'bg-emerald-50 dark:bg-emerald-900/20'
      default: return 'bg-blue-50 dark:bg-blue-900/20'
    }
  }

  const filteredNotifications = useMemo(() => {
    const filtered = notifications.filter((n: any) => {
      if (filter === 'unread') return !n.is_read
      if (filter === 'critical') return n.severity === 'critical'
      return true
    })
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [notifications, filter])

  return (
    <div
      ref={containerRef}
      className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300"
    >
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
        </div>
      )}

      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-sm rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300 border border-gray-200/70 dark:border-slate-700">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-[12px] font-semibold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* 🔥 HEADER UNIFICADO */}
      <div className="sticky top-0 z-30 bg-[#f8f9fa]/92 dark:bg-slate-900/92 backdrop-blur-xl px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-slate-800">
        <div className="rounded-[24px] border border-gray-200/70 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 shadow-sm px-4 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => router.push('/more')}
                className="h-10 w-10 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 flex items-center justify-center text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98] shrink-0"
              >
                <ChevronLeft size={20} />
              </button>

              <div className="min-w-0">
                <h2 className="text-[22px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                  Notificações
                </h2>
                <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Atualizações e alertas do app
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <button
                  onClick={handleClearAll}
                  disabled={processing}
                  className="h-10 w-10 rounded-[16px] border border-red-200/70 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors active:scale-[0.98]"
                >
                  <Trash2 size={16} />
                </button>
              )}

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="h-10 px-3 rounded-[16px] border border-gray-200/70 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-[12px] font-semibold text-teal-700 dark:text-teal-400 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors active:scale-[0.98]"
                >
                  Marcar todas
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hide">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'unread', label: 'Não lidas' },
              { key: 'critical', label: 'Críticas' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`h-10 px-3.5 rounded-[18px] border whitespace-nowrap shrink-0 text-[13px] font-semibold transition-colors active:scale-[0.98] ${
                  filter === f.key
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200/70 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {f.label}
                {f.key === 'unread' && unreadCount > 0 && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/20 dark:bg-gray-900/10">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-3">
        {loading ? (
          <NotificationsSkeleton />
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full border border-gray-200/70 dark:border-slate-700 shadow-sm flex items-center justify-center mb-4">
              <Bell size={28} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-semibold text-[16px] text-gray-800 dark:text-gray-100 mb-1">
              {filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
            </h3>
            <p className="text-gray-400 dark:text-gray-500 text-[12px] max-w-[250px]">
              {filter === 'critical'
                ? 'Nenhuma notificação crítica no momento.'
                : 'Você está em dia com todas as novidades!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 animate-in fade-in duration-300">
            {filteredNotifications.map((notif: any) => {
              const isUnread = !notif.is_read
              return (
                <div
                  key={notif.id}
                  className={`bg-white dark:bg-slate-800 rounded-[24px] border shadow-sm p-2 transition-all ${
                    isUnread
                      ? 'border-teal-200/80 dark:border-teal-800/50'
                      : 'border-gray-200/70 dark:border-slate-700'
                  }`}
                >
                  <div className="rounded-[18px] p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 ${getSeverityBg(notif.severity)}`}>
                        {getSeverityIcon(notif.severity)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-[14px] text-gray-900 dark:text-gray-100 truncate">
                            {notif.title}
                          </p>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                          )}
                        </div>

                        {notif.subtitle && (
                          <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-0.5">
                            {notif.subtitle}
                          </p>
                        )}

                        <div className="flex items-center justify-between gap-3 mt-2">
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {format(new Date(notif.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isUnread && (
                              <button
                                onClick={() => markAsRead(notif.id)}
                                className="h-8 w-8 rounded-full flex items-center justify-center text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors active:scale-[0.95]"
                              >
                                <Check size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notif.id)}
                              className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-[0.95]"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}