'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Bell, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Notification {
  id: string
  title: string
  subtitle?: string
  severity?: 'info' | 'warning' | 'critical'
  isRead?: boolean
  created_at: string
}

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
  notifications: Notification[]
  onReadChange?: () => void
}

export function NotificationCenter({ isOpen, onClose, notifications, onReadChange }: NotificationCenterProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const severityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle size={18} className="text-red-500" />
      case 'warning': return <AlertCircle size={18} className="text-amber-500" />
      default: return <Info size={18} className="text-blue-500" />
    }
  }

  const unreadCount = notifications.filter(n => !n.isRead).length

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200/50 dark:border-slate-700/50 p-6 max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-600 dark:text-purple-400">
              <Bell size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Notificações</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Tudo lido'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-400 hover:text-gray-600 dark:text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Lista de notificações */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
              <Bell size={40} className="mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 rounded-2xl border transition-all ${
                  notif.isRead
                    ? 'bg-gray-50 dark:bg-slate-800/50 border-gray-100 dark:border-slate-700/50'
                    : 'bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-800/50 shadow-sm'
                }`}
                onClick={() => {
                  // Marcar como lida
                  if (!notif.isRead && onReadChange) {
                    // Supondo que a função onReadChange lide com a atualização
                    onReadChange()
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{severityIcon(notif.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${notif.isRead ? 'text-gray-600 dark:text-gray-300' : 'text-gray-800 dark:text-white'}`}>
                      {notif.title}
                    </p>
                    {notif.subtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{notif.subtitle}</p>
                    )}
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                      {format(new Date(notif.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0 mt-1.5" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé com botão fechar */}
        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors border-t border-gray-100 dark:border-slate-700 pt-4"
        >
          Fechar
        </button>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}