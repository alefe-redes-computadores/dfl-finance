'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useIsAdmin } from '@/hooks/useAdmin'
import { useLocalSync } from '@/hooks/useLocalSync'
import { RefreshCw, Wifi, WifiOff, X, Shield } from 'lucide-react'

interface SyncStatusModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SyncStatusModal({ isOpen, onClose }: SyncStatusModalProps) {
  const localSync = useLocalSync()
  const { isAdmin } = useIsAdmin() || { isAdmin: false }

  const pendingCount = Number(localSync?.pendingCount ?? 0)
  const isSyncing = Boolean(localSync?.isSyncing)
  const forceSync = localSync?.forceSync
  const isOnline = localSync?.isOnline
  const syncStatus = localSync?.syncStatus

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!isOpen || !mounted) return null

  const browserOnline =
    typeof window !== 'undefined' && typeof navigator !== 'undefined'
      ? navigator.onLine
      : true

  const isOnlineStatus = typeof isOnline === 'boolean' ? isOnline : browserOnline
  const StatusIcon = isOnlineStatus ? Wifi : WifiOff
  const statusColor = isOnlineStatus ? 'text-emerald-500' : 'text-red-500'
  const statusText = isOnlineStatus ? 'Online' : 'Offline'
  const syncStatusText =
    isSyncing
      ? 'Sincronizando...'
      : pendingCount > 0
        ? `${pendingCount} pendente(s)`
        : syncStatus === 'offline'
          ? 'Aguardando conexão'
          : 'Tudo sincronizado'

  const handleForceSync = () => {
    if (!isOnlineStatus || isSyncing) return
    if (typeof forceSync === 'function') {
      forceSync()
    }
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200/50 dark:border-slate-700/50 p-6 transform transition-all duration-300 animate-in fade-in zoom-in-95 slide-in-from-bottom-4"
        style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-full text-teal-600 dark:text-teal-400">
              <RefreshCw size={22} className={isSyncing ? 'animate-spin' : ''} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Sincronização</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <StatusIcon size={14} className={statusColor} />
                <span className={`text-xs font-medium ${statusColor}`}>{statusText}</span>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{syncStatusText}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-400 hover:text-gray-600 dark:text-gray-500"
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-4 mb-6 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Itens pendentes</span>
          <span className="text-2xl font-bold text-gray-800 dark:text-white">
            {pendingCount}
          </span>
        </div>

        <button
          onClick={handleForceSync}
          disabled={isSyncing || !isOnlineStatus}
          type="button"
          className={`
            w-full py-3.5 rounded-2xl font-bold text-white transition-all duration-200
            flex items-center justify-center gap-2
            ${isSyncing || !isOnlineStatus
              ? 'bg-gray-300 dark:bg-slate-700 cursor-not-allowed opacity-70'
              : 'bg-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/30 active:scale-[0.97]'
            }
          `}
        >
          {isSyncing ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              <span>Sincronizando...</span>
            </>
          ) : !isOnlineStatus ? (
            <>
              <WifiOff size={18} />
              <span>Sem conexão</span>
            </>
          ) : (
            <>
              <RefreshCw size={18} />
              <span>Forçar Sincronização</span>
            </>
          )}
        </button>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          type="button"
        >
          Fechar
        </button>

        {isAdmin && (
          <Link
            href="/admin/sync"
            onClick={onClose}
            className="mt-4 w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800/30 rounded-2xl transition-all group active:scale-[0.97]"
          >
            <Shield size={18} className="text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
              Acessar Painel de Admin
            </span>
            <span className="text-purple-400 dark:text-purple-500 group-hover:translate-x-0.5 transition-transform">→</span>
          </Link>
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}