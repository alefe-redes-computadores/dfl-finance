// src/hooks/useLocalSync.ts
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db, addToSyncQueue, getPendingSyncItems, removeFromSyncQueue, markSyncFailed } from '@/lib/db'
import { useToast } from '@/contexts/ToastContext'

type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline'

type AllTables = 
  | 'transactions' 
  | 'accounts' 
  | 'categories' 
  | 'debts' 
  | 'loans' 
  | 'financings' 
  | 'subscriptions' 
  | 'tags' 
  | 'contacts' 
  | 'budgets' 
  | 'goals' 
  | 'credit_cards' 
  | 'credit_invoices' 
  | 'notifications'

const MAX_SYNC_ATTEMPTS = 3

export function useLocalSync() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)
  const isSyncing = useRef(false)
  const syncAttempts = useRef(0)

  // ============================================================
  // ATUALIZA STATUS DA FILA
  // ============================================================
  const updatePendingCount = useCallback(async () => {
    if (!user?.id) return
    const items = await getPendingSyncItems(user.id)
    setPendingCount(items.length)
  }, [user?.id])

  // ============================================================
  // PROCESSAR FILA DE SINCRONIZAÇÃO (COM LIMITE DE TENTATIVAS)
  // ============================================================
  const processSyncQueue = useCallback(async () => {
    if (!user?.id || isSyncing.current || !isOnline) return

    // Limite de tentativas para evitar loop infinito
    if (syncAttempts.current >= MAX_SYNC_ATTEMPTS) {
      console.warn('Limite de tentativas de sincronização atingido. Aguardando próxima janela.')
      return
    }

    isSyncing.current = true
    syncAttempts.current++
    setSyncStatus('syncing')

    try {
      const items = await getPendingSyncItems(user.id)

      if (items.length === 0) {
        setSyncStatus(isOnline ? 'online' : 'offline')
        syncAttempts.current = 0
        isSyncing.current = false
        return
      }

      for (const item of items) {
        try {
          const { table, operation, record_id, data } = item

          let supabaseTable: string = table

          // Mapeia tabelas do IndexedDB para tabelas do Supabase
          if (table === 'credit_cards') supabaseTable = 'credit_cards'
          if (table === 'credit_invoices') supabaseTable = 'credit_invoices'

          const supabaseClient = supabase.from(supabaseTable)

          let error = null

          if (operation === 'create') {
            const { error: e } = await supabaseClient.insert(data)
            error = e
          } else if (operation === 'update') {
            const { error: e } = await supabaseClient.update(data).eq('id', record_id)
            error = e
          } else if (operation === 'delete') {
            const { error: e } = await supabaseClient.delete().eq('id', record_id)
            error = e
          }

          if (error) {
            throw new Error(`Erro ao sincronizar ${table} ${operation}: ${error.message}`)
          }

          // Remove da fila após sucesso
          await removeFromSyncQueue(item.id)

        } catch (err: any) {
          console.error('Erro na sincronização:', err)
          await markSyncFailed(item.id, err.message)
        }
      }

      // Atualiza contador
      await updatePendingCount()

      // Reseta contador de tentativas se concluiu
      syncAttempts.current = 0

      if (pendingCount === 0) {
        setSyncStatus(isOnline ? 'online' : 'offline')
      }

    } catch (err) {
      console.error('Erro ao processar fila:', err)
    } finally {
      isSyncing.current = false
    }
  }, [user?.id, isOnline, pendingCount, updatePendingCount])

  // ============================================================
  // RESETAR CONTADOR DE TENTATIVAS PERIODICAMENTE
  // ============================================================
  useEffect(() => {
    const interval = setInterval(() => {
      syncAttempts.current = 0
    }, 30000) // Reseta a cada 30 segundos

    return () => clearInterval(interval)
  }, [])

  // ============================================================
  // ESCUTAR EVENTOS ONLINE/OFFLINE
  // ============================================================
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus('online')
      syncAttempts.current = 0 // Reseta ao ficar online
      showToast('🌐 Conexão restaurada. Sincronizando...', 'info')
      processSyncQueue()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
      showToast('📡 Modo offline ativado.', 'warning')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Sincroniza ao carregar se estiver online
    if (isOnline) {
      processSyncQueue()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processSyncQueue, showToast])

  // ============================================================
  // FUNÇÕES EXPORTADAS
  // ============================================================

  /**
   * Adiciona uma operação à fila de sincronização
   */
  const queueOperation = useCallback(async (
    table: AllTables,
    operation: 'create' | 'update' | 'delete',
    recordId: string,
    data: any
  ) => {
    if (!user?.id) return

    await addToSyncQueue(user.id, table, operation, recordId, data)
    await updatePendingCount()

    // Se estiver online, tenta sincronizar imediatamente
    if (isOnline && syncAttempts.current < MAX_SYNC_ATTEMPTS) {
      processSyncQueue()
    }
  }, [user?.id, isOnline, updatePendingCount, processSyncQueue])

  /**
   * Sincroniza forçadamente (pull-to-refresh)
   */
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      showToast('📡 Sem conexão. As alterações serão sincronizadas quando a internet voltar.', 'warning')
      return
    }

    showToast('🔄 Sincronizando...', 'info')
    syncAttempts.current = 0 // Reseta ao forçar
    await processSyncQueue()
    showToast('✅ Sincronização concluída!', 'success')
  }, [isOnline, processSyncQueue, showToast])

  /**
   * Atualiza a contagem da fila
   */
  const refreshPendingCount = useCallback(async () => {
    await updatePendingCount()
  }, [updatePendingCount])

  return {
    syncStatus,
    isOnline,
    pendingCount,
    isSyncing: isSyncing.current,
    queueOperation,
    forceSync,
    refreshPendingCount,
  }
}