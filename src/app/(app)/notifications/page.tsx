'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, Bell, BellOff, Check, X, RefreshCw,
  AlertTriangle, Info, CheckCircle, Clock, Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useToast } from '@/contexts/ToastContext'
import { useLocalData } from '@/hooks/useLocalData'
import { db } from '@/lib/db' // 🔥 ADICIONADO

// ============================================================
// SKELETON LOADER
// ============================================================
const NotificationsSkeleton = () => (
  <div className="space-y-3 animate-pulse">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-gray-200 dark:bg-slate-700 rounded" />
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
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all')
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // ============================================================
  // 🔥 CORRIGIDO: Removidos orderBy e realtime
  // ============================================================
  const { data: localNotifications, loading: notifLoading, reload: reloadNotifications } = useLocalData({
    table: 'notifications' as any,
    filters: { user_id: user?.id },
  })

  // 🔥 REMOVIDOS: const { create: createNotification, update: updateNotification, remove: removeNotification } = useLocalData({ table: 'notifications' as any })

  // ============================================================
  // PULL TO REFRESH
  // ============================================================
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
      loadNotifications().finally(() => setRefreshing(false))
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

  // ============================================================
  // LOAD DATA
  // ============================================================
  const loadNotifications = async () => {
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
  }

  useEffect(() => {
    if (user?.id) {
      loadNotifications()
    }
  }, [user?.id])

  // ============================================================
  // PROCESSAR DADOS
  // ============================================================
  useEffect(() => {
    if (localNotifications) {
      setNotifications(localNotifications)
      const unread = localNotifications.filter((n: any) => !n.read).length
      setUnreadCount(unread)
    }
  }, [localNotifications])

  // ============================================================
  // 🔥 HANDLERS CORRIGIDOS
  // ============================================================
  const markAsRead = async (id: string) => {
    try {
      await db.table('notifications').update(id, { 
        read: true,
        updated_at: new Date().toISOString()
      })
      showToast('Notificação marcada como lida.', 'info')
      loadNotifications()
    } catch (err: any) {
      showToast(`Erro: ${err.message}`, 'error')
    }
  }

  const markAllAsRead = async () => {
    if (!user?.id || notifications.length === 0) return

    try {
      const unread = notifications.filter((n: any) => !n.read)
      for (const notif of unread) {
        await db.table('notifications').update(notif.id, { 
          read: true,
          updated_at: new Date().toISOString()
        })
      }
      showToast('Todas as notificações marcadas como lidas!', 'success')
      loadNotifications()
    } catch (err: any) {
      showToast(`Erro: ${err.message}`, 'error')
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      await db.table('notifications').delete(id)
      showToast('Notificação removida.', 'info')
      loadNotifications()
    } catch (err: any) {
      showToast(`Erro: ${err.message}`, 'error')
    }
  }

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

  const filteredNotifications = notifications.filter((n: any) => {
    if (filter === 'unread') return !n.read
    if (filter === 'critical') return n.severity === 'critical'
    return true
  })

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans px-4 pt-6 transition-colors duration-300">
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-[20px] font-bold text-gray-800 dark:text-gray-100">Notificações</h2>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-teal-700 dark:text-teal-400 text-sm font-bold hover:opacity-80 transition-colors"
          >
            Marcar todas
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {[
          { key: 'all', label: 'Todas' },
          { key: 'unread', label: 'Não lidas' },
          { key: 'critical', label: 'Críticas' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-4 py-2 rounded-full text-[12px] font-bold whitespace-nowrap transition-all border ${
              filter === f.key
                ? 'bg-teal-700 text-white border-teal-700 shadow-md'
                : 'bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
            {f.key === 'unread' && unreadCount > 0 && (
              <span className="ml-1 text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300 px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <NotificationsSkeleton />
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
            <Bell size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">
            {filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-[250px]">
            {filter === 'critical' 
              ? 'Nenhuma notificação crítica no momento.' 
              : 'Você está em dia com todas as novidades!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-in fade-in duration-300">
          {filteredNotifications.map((notif: any) => {
            const isUnread = !notif.read
            return (
              <div
                key={notif.id}
                className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border transition-all ${
                  isUnread 
                    ? 'border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-900/10' 
                    : 'border-gray-100 dark:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getSeverityBg(notif.severity)}`}>
                    {getSeverityIcon(notif.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-[14px] text-gray-800 dark:text-gray-200 truncate">
                        {notif.title}
                      </p>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                      )}
                    </div>
                    {notif.subtitle && (
                      <p className="text-[13px] text-gray-600 dark:text-gray-400 mt-0.5">
                        {notif.subtitle}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {format(new Date(notif.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      <div className="flex items-center gap-2">
                        {isUnread && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="text-teal-700 dark:text-teal-400 text-[10px] font-bold hover:opacity-80 transition-colors"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notif.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
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
  )
}