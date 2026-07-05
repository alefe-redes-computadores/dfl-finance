// src/hooks/useLocalSync.ts
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'

export function useLocalSync() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)

  // ============================================================
  // ESCUTAR EVENTOS ONLINE/OFFLINE (sem sincronizar)
  // ============================================================
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      showToast('🌐 Online', 'info')
    }

    const handleOffline = () => {
      setIsOnline(false)
      showToast('📡 Modo offline', 'warning')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [showToast])

  /**
   * Placeholder - não faz nada
   */
  const queueOperation = useCallback(async () => {
    // Desativado temporariamente
  }, [])

  const forceSync = useCallback(async () => {
    showToast('⚠️ Sincronização desativada temporariamente', 'warning')
  }, [showToast])

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(0)
  }, [])

  return {
    syncStatus: isOnline ? 'online' : 'offline',
    isOnline,
    pendingCount,
    isSyncing: false,
    queueOperation,
    forceSync,
    refreshPendingCount,
  }
}