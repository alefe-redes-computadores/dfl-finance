// src/hooks/useLocalSync.ts
'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/contexts/ToastContext'
import {
  configureSyncEngine,
  getServerSyncSnapshot,
  getSyncSnapshot,
  processSyncQueue,
  refreshPendingCount,
  subscribeSyncSnapshot,
  type SyncCycleResult,
} from '@/lib/syncEngine'

const EMPTY_RESULT: SyncCycleResult = {
  success: false,
  pushFailures: 0,
  pendingCount: 0,
  pullSuccess: false,
  pullFailedTables: [],
}

export function useLocalSync() {
  const { user } = useAuth()
  const { showToast } = useToast()

  const syncSnapshot = useSyncExternalStore(
    subscribeSyncSnapshot,
    getSyncSnapshot,
    getServerSyncSnapshot
  )

  useEffect(() => {
    configureSyncEngine(user?.id ?? null)
  }, [user?.id])

  const forceSync = useCallback(async (): Promise<SyncCycleResult> => {
    configureSyncEngine(user?.id ?? null)

    if (!user?.id) {
      return EMPTY_RESULT
    }

    if (!getSyncSnapshot().isOnline) {
      showToast('Sem conexão.', 'warning')

      return {
        ...EMPTY_RESULT,
        pendingCount: getSyncSnapshot().pendingCount,
      }
    }

    return processSyncQueue(false)
  }, [showToast, user?.id])

  const forceFullResync = useCallback(async (): Promise<SyncCycleResult> => {
    configureSyncEngine(user?.id ?? null)

    if (!user?.id) {
      return EMPTY_RESULT
    }

    if (!getSyncSnapshot().isOnline) {
      showToast('Sem conexão.', 'warning')

      return {
        ...EMPTY_RESULT,
        pendingCount: getSyncSnapshot().pendingCount,
      }
    }

    const result = await processSyncQueue(true)

    if (result.success) {
      showToast('Ressincronização completa concluída.', 'success')
      return result
    }

    if (result.pendingCount > 0) {
      showToast(
        `Ressincronização incompleta: ${result.pendingCount} item(ns) ainda aguardando sincronização.`,
        'warning'
      )
      return result
    }

    if (!result.pullSuccess) {
      const pullMessage =
        result.pullFailedTables.length > 0
          ? `${result.pullFailedTables.length} tabela(s) falharam no recebimento.`
          : 'O recebimento remoto não foi concluído.'

      showToast(
        `Ressincronização incompleta: ${pullMessage}`,
        'warning'
      )
      return result
    }

    showToast(
      'Ressincronização incompleta. Algumas operações precisam de nova tentativa.',
      'warning'
    )

    return result
  }, [showToast, user?.id])

  const refreshPendingCountForUser = useCallback(async () => {
    await refreshPendingCount(user?.id ?? null)
  }, [user?.id])

  return {
    ...syncSnapshot,
    forceSync,
    forceFullResync,
    refreshPendingCount: refreshPendingCountForUser,
  }
}
