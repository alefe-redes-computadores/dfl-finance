'use client'

import { useState } from 'react'
import { useLocalSync } from '@/hooks/useLocalSync'
import { Loader2, Check, RefreshCw, WifiOff } from 'lucide-react'
import SyncStatusModal from './SyncStatusModal'

export function SyncStatusIndicator() {
  const localSync = useLocalSync()
  const syncStatus = localSync?.syncStatus ?? 'idle'
  const pendingCount = Number(localSync?.pendingCount ?? 0)

  const [isModalOpen, setIsModalOpen] = useState(false)

  const handlePress = () => {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      navigator.vibrate(20)
    }
    setIsModalOpen(true)
  }

  const getStatusStyle = () => {
    switch (syncStatus) {
      case 'syncing':
        return 'bg-blue-500 text-white animate-pulse'
      case 'offline':
        return 'bg-gray-400 text-white'
      default:
        return pendingCount > 0 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
    }
  }

  const getIcon = () => {
    if (syncStatus === 'syncing') return <Loader2 size={18} className="animate-spin" />
    if (syncStatus === 'offline') return <WifiOff size={18} />
    if (pendingCount > 0) return <RefreshCw size={18} />
    return <Check size={18} />
  }

  return (
    <>
      <button
        onClick={handlePress}
        className={`fixed top-[5rem] right-4 z-40 flex items-center justify-center w-12 h-12 rounded-full shadow-lg backdrop-blur-md border border-white/20 transition-all active:scale-90 ${getStatusStyle()}`}
        title={pendingCount > 0 ? `${pendingCount} itens pendentes` : 'Tudo sincronizado'}
        type="button"
      >
        {getIcon()}
      </button>

      <SyncStatusModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}