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
      className="relative w-10 h-10 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors active:scale-90"
      title={`${pendingCount} item(ns) pendente(s)`}
    >
      {isSyncing ? (
        <Loader2 size={20} className="animate-spin text-teal-600" />
      ) : (
        <>
          <RefreshCw size={20} />
          {pendingCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white bg-orange-500 shadow-sm border-2 border-white dark:border-slate-900">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </>
      )}
    </button>
  )
}
