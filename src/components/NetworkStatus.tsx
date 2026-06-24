'use client'

import { Wifi, WifiOff } from 'lucide-react'

interface NetworkStatusProps {
  isOnline: boolean
  pendingCount: number
}

export default function NetworkStatus({ isOnline, pendingCount }: NetworkStatusProps) {
  if (isOnline && pendingCount === 0) return null

  return (
    <div className={`fixed top-0 left-0 right-0 z-[300] px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
      isOnline 
        ? 'bg-emerald-600 text-white' 
        : 'bg-red-500 text-white'
    }`}>
      {isOnline ? (
        <>
          <Wifi size={14} />
          {pendingCount > 0 
            ? `Sincronizando ${pendingCount} transação(ões)...` 
            : 'Conectado'}
        </>
      ) : (
        <>
          <WifiOff size={14} />
          Modo offline — dados salvos localmente
        </>
      )}
    </div>
  )
}
