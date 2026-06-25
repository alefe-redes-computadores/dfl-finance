'use client'

import { RefreshCw, Loader2 } from 'lucide-react'

interface SyncButtonProps {
  pendingCount: number
  isSyncing: boolean
  onSync: () => void
}

export default function SyncButton({ pendingCount, isSyncing, onSync }: SyncButtonProps) {
  if (pendingCount === 0 && !isSyncing) return null

  return (
    <button
      onClick={onSync}
      disabled={isSyncing}
      className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
      title={`${pendingCount} item(ns) pendente(s)`}
    >
      {isSyncing ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <>
          <RefreshCw size={20} />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white bg-orange-500">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </>
      )}
    </button>
  )
}
