'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import {
  ChevronLeft, RefreshCw, Bell, BellOff, CheckCheck, X,
  Info, AlertTriangle, CheckCircle, AlertCircle, Clock,
  Calendar, Filter, Loader2
} from 'lucide-react'
import { format, isToday, isYesterday, startOfWeek, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ContextToggle, { useContext_ } from '@/components/ContextToggle'
import { useToast } from '@/contexts/ToastContext'

// ============================================================
// SKELETON LOADER
// ============================================================
const NotificationsSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="h-5 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="h-9 w-28 bg-gray-200 dark:bg-slate-700 rounded-full" />
    </div>

    <div className="flex gap-2 overflow-x-auto pb-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-8 w-20 bg-gray-200 dark:bg-slate-700 rounded-full flex-shrink-0" />
      ))}
    </div>

    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border border-gray-50 dark:border-slate-700">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-32 bg-gray-200 dark:bg-slate-700 rounded" />
              <div className="h-3 w-20 bg-gray-100 dark:bg-slate-700/50 rounded" />
            </div>
            <div className="h-3 w-full bg-gray-100 dark:bg-slate-700/50 rounded" />
            <div className="h-3 w-3/4 bg-gray-100 dark:bg-slate-700/50 rounded" />
          </div>
        </div>
      </div>
    ))}
  </div>
)

export default function NotificationsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { context } = useContext_()
  const { showToast } = useToast()

  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingPulse, setLoadingPulse] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all')
  const [markingAll, setMarkingAll] = useState(false)

  // Pull to refresh
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

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadingPulse(true)

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('context', context)
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('type', filter)
    }

    const { data } = await query
    setNotifications(Array.isArray(data) ? data : [])
    setLoading(false)
    setLoadingPulse(false)
  }, [user, context, filter])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  const markAsRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .eq('id', id)
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
    if (unreadIds.length === 0) {
      showToast('Todas as notificações já estão lidas.', 'info')
      return
    }

    setMarkingAll(true)
    await supabase
      .from('notifications')
      .update({ read: true, updated_at: new Date().toISOString() })
      .in('id', unreadIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setMarkingAll(false)
    showToast(`${unreadIds.length} notificações marcadas como lidas.`, 'success')
  }

  const deleteNotification = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return <Info size={18} className="text-blue-500" />
      case 'success': return <CheckCircle size={18} className="text-emerald-500" />
      case 'warning': return <AlertTriangle size={18} className="text-orange-500" />
      case 'error': return <AlertCircle size={18} className="text-red-500" />
      default: return <Bell size={18} className="text-gray-500" />
    }
  }

  const getTypeColor = (type: string, read: boolean) => {
    const base = {
      info: 'border-blue-200 dark:border-blue-800',
      success: 'border-emerald-200 dark:border-emerald-800',
      warning: 'border-orange-200 dark:border-orange-800',
      error: 'border-red-200 dark:border-red-800',
    }[type] || 'border-gray-200 dark:border-gray-700'
    return read ? 'opacity-60' : base
  }

  const getTypeBg = (type: string, read: boolean) => {
    if (read) return 'bg-white dark:bg-slate-800'
    switch (type) {
      case 'info': return 'bg-blue-50 dark:bg-blue-900/20'
      case 'success': return 'bg-emerald-50 dark:bg-emerald-900/20'
      case 'warning': return 'bg-orange-50 dark:bg-orange-900/20'
      case 'error': return 'bg-red-50 dark:bg-red-900/20'
      default: return 'bg-white dark:bg-slate-800'
    }
  }

  const getTypeBgIcon = (type: string) => {
    switch (type) {
      case 'info': return 'bg-blue-100 dark:bg-blue-900/30'
      case 'success': return 'bg-emerald-100 dark:bg-emerald-900/30'
      case 'warning': return 'bg-orange-100 dark:bg-orange-900/30'
      case 'error': return 'bg-red-100 dark:bg-red-900/30'
      default: return 'bg-gray-100 dark:bg-slate-700'
    }
  }

  const groupByDate = (items: any[]) => {
    const groups: Record<string, any[]> = {}
    const now = new Date()
    const weekStart = startOfWeek(now, { locale: ptBR })

    items.forEach(item => {
      const date = new Date(item.created_at)
      let key: string
      if (isToday(date)) key = 'Hoje'
      else if (isYesterday(date)) key = 'Ontem'
      else if (differenceInDays(now, date) <= 7) key = 'Esta semana'
      else if (differenceInDays(now, date) <= 30) key = 'Este mês'
      else key = 'Anterior'
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })

    return groups
  }

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'all') return true
    return n.type === filter
  })

  const groupedNotifications = groupByDate(filteredNotifications)
  const filterOrder = ['Hoje', 'Ontem', 'Esta semana', 'Este mês', 'Anterior']

  const unreadCount = notifications.filter(n => !n.read).length

  const filters = [
    { key: 'all', label: 'Todas', icon: Bell },
    { key: 'info', label: 'Info', icon: Info },
    { key: 'success', label: 'Sucesso', icon: CheckCircle },
    { key: 'warning', label: 'Alerta', icon: AlertTriangle },
    { key: 'error', label: 'Erro', icon: AlertCircle },
  ]

  return (
    <div ref={containerRef} className="max-w-md mx-auto min-h-screen bg-[#f8f9fa] dark:bg-slate-900 pb-28 font-sans transition-colors duration-300">
      {/* Indicador de carregamento sutil */}
      {loadingPulse && (
        <div className="fixed top-20 right-4 z-50">
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-pulse shadow-lg shadow-teal-500/50" />
        </div>
      )}

      {/* Pull to refresh */}
      {refreshing && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 pointer-events-none">
          <div className="bg-white dark:bg-slate-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2 animate-in slide-in-from-top-2 duration-300">
            <RefreshCw size={16} className="animate-spin text-teal-600" />
            <span className="text-xs font-bold text-teal-600">Atualizando...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-800 px-4 pt-6 pb-4 shadow-sm border-b border-gray-50 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => router.push('/home')} className="p-2 -ml-2 text-gray-800 dark:text-gray-200 hover:text-gray-500 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-teal-500" />
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Alertas</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={loadNotifications}
            className="p-2 text-gray-400 hover:text-teal-600 transition-colors"
          >
            <RefreshCw size={20} className={loadingPulse ? 'animate-spin' : ''} />
          </button>
        </div>
        <ContextToggle />
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Ações */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-full shadow-sm border border-gray-50 dark:border-slate-700 overflow-x-auto">
            {filters.map(f => {
              const Icon = f.icon
              const count = notifications.filter(n => f.key === 'all' || n.type === f.key).length
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key as any)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all whitespace-nowrap ${
                    filter === f.key
                      ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400'
                      : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon size={12} />
                  {f.label}
                  <span className="text-[9px] opacity-60">({count})</span>
                </button>
              )
            })}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll}
              className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded-full text-[10px] font-bold hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors disabled:opacity-50"
            >
              {markingAll ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              Marcar todas
            </button>
          )}
        </div>

        {loading ? (
          <NotificationsSkeleton />
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <BellOff size={40} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">
              {filter === 'all' ? 'Nenhuma notificação' : `Nenhuma notificação do tipo "${filters.find(f => f.key === filter)?.label}"`}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-[250px]">
              {filter === 'all' 
                ? 'As notificações aparecerão aqui quando houver novidades.' 
                : 'Tente outro filtro ou aguarde novas notificações.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-300">
            {filterOrder.map(groupKey => {
              const items = groupedNotifications[groupKey] || []
              if (items.length === 0) return null

              return (
                <div key={groupKey}>
                  <p className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mb-2 px-1">
                    {groupKey}
                  </p>
                  <div className="space-y-2">
                    {items.map(notification => {
                      const isRead = notification.read
                      const type = notification.type || 'info'

                      return (
                        <div
                          key={notification.id}
                          className={`bg-white dark:bg-slate-800 rounded-[20px] p-4 shadow-sm border transition-all hover:shadow-md ${
                            isRead 
                              ? 'opacity-60 border-gray-100 dark:border-slate-700' 
                              : `border-l-4 ${getTypeColor(type, false)}`
                          } ${getTypeBg(type, isRead)}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeBgIcon(type)}`}>
                              {getTypeIcon(type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className={`font-bold text-[14px] text-gray-800 dark:text-gray-200 ${
                                    !isRead ? 'text-gray-900 dark:text-gray-100' : ''
                                  }`}>
                                    {notification.title || 'Notificação'}
                                  </p>
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                    {notification.message}
                                  </p>
                                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
                                    <Clock size={10} />
                                    {format(new Date(notification.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {!isRead && (
                                    <button
                                      onClick={() => markAsRead(notification.id)}
                                      className="p-1 text-gray-400 hover:text-teal-600 transition-colors"
                                      title="Marcar como lida"
                                    >
                                      <CheckCheck size={14} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deleteNotification(notification.id)}
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Remover"
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
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}