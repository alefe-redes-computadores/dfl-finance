'use client'

import { Wifi, WifiOff, Loader2, X } from 'lucide-react'
import { useState } from 'react'

interface NetworkStatusProps {
  isOnline: boolean
  pendingCount: number
  isSyncing?: boolean
}

export default function NetworkStatus({ isOnline, pendingCount, isSyncing = false }: NetworkStatusProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (isOnline && pendingCount === 0 && !isSyncing) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-[300] px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2 transition-all ${
      isOnline && isSyncing
        ? 'bg-emerald-600 text-white animate-pulse'
        : isOnline
        ? 'bg-emerald-600 text-white'
        : 'bg-red-500 text-white'
    }`}>
      {isOnline && isSyncing ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          Sincronizando {pendingCount} transação(ões)...
        </>
      ) : isOnline ? (
        <>
          <Wifi size={14} />
          {pendingCount > 0
            ? `${pendingCount} item(ns) pendente(s) de sincronização`
            : 'Conectado'}
        </>
      ) : (
        <>
          <WifiOff size={14} />
          Modo offline — {pendingCount > 0 ? `${pendingCount} transação(ões) salva(s) localmente` : 'dados serão salvos localmente'}
        </>
      )}
      
      {(pendingCount > 0 || isSyncing) && (
        <button
          onClick={() => setDismissed(true)}
          className="ml-2 p-0.5 rounded-full hover:bg-white/20 transition-colors"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}