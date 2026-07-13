'use client'

import { RefreshCw, CloudOff } from 'lucide-react'

interface SyncButtonProps {
  pendingCount: number
  isSyncing: boolean
  isOnline: boolean
  onSync: () => void
  onClick?: () => void
}

export default function SyncButton({
  pendingCount,
  isSyncing,
  isOnline,
  onSync,
  onClick
}: SyncButtonProps) {
  const safePending = Number.isFinite(pendingCount) ? Math.max(0, pendingCount) : 0
  const isOffline = !isOnline

  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }

    if (!isSyncing) {
      onSync()
    }
  }

  return (
    <button
      onClick={handleClick}
      className="relative p-2 rounded-full transition-all active:scale-[0.95] hover:bg-gray-50 dark:hover:bg-slate-700/50"
      title={isOffline ? 'Sem conexão' : isSyncing ? 'Sincronizando...' : safePending > 0 ? `${safePending} pendente(s)` : 'Sincronizado'}
      aria-label={isOffline ? 'Sem conexão' : isSyncing ? 'Sincronizando' : 'Status de sincronização'}
      type="button"
    >
      {isOffline ? (
        <CloudOff size={20} className="text-amber-500 transition-colors" />
      ) : (
        <RefreshCw
          size={20}
          className={`text-gray-600 dark:text-gray-300 transition-colors ${isSyncing ? 'animate-spin' : ''}`}
        />
      )}

      {safePending > 0 && (
        <span
          className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full text-[9px] font-bold flex items-center justify-center text-white shadow-sm px-1 ${
            isOffline ? 'bg-amber-500' : 'bg-teal-500'
          }`}
        >
          {safePending > 99 ? '99+' : safePending}
        </span>
      )}
    </button>
  )
}