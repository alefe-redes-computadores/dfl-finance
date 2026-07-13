// src/hooks/useLocalSync.ts
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db, addToSyncQueue, getPendingSyncItems, removeFromSyncQueue, markSyncFailed } from '@/lib/db'
import { useToast } from '@/contexts/ToastContext'

type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline'

type AllTables = 
  | 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' 
  | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' 
  | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications'

export function useLocalSync() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)
  const isSyncing = useRef(false)

  const updatePendingCount = useCallback(async () => {
    if (!user?.id) return
    const items = await getPendingSyncItems(user.id)
    setPendingCount(items.length)
  }, [user?.id])

  const processSyncQueue = useCallback(async () => {
    console.log('[DEBUG] 1. INICIANDO processSyncQueue...')
    
    if (!user?.id) { console.log('[DEBUG] Cancelado: Usuário não logado.'); return }
    if (isSyncing.current) { console.log('[DEBUG] Cancelado: Já existe uma sincronização rodando.'); return }
    if (!isOnline) { console.log('[DEBUG] Cancelado: Dispositivo offline.'); return }

    isSyncing.current = true
    setSyncStatus('syncing')

    try {
      const items = await getPendingSyncItems(user.id)
      console.log(`[DEBUG] 2. Itens encontrados na fila:`, items)

      if (items.length === 0) {
        setSyncStatus(isOnline ? 'online' : 'offline')
        isSyncing.current = false
        console.log('[DEBUG] 3. Fila vazia, encerrando sincronização.')
        return
      }

      for (const item of items) {
        console.log(`[DEBUG] 4. Processando item:`, item)
        try {
          const { table, operation, record_id, data } = item
          
          // Correção de nomes de tabela caso necessário
          let supabaseTable: string = table
          if (table === 'credit_cards') supabaseTable = 'credit_cards'
          if (table === 'credit_invoices') supabaseTable = 'credit_invoices'

          const supabaseClient = supabase.from(supabaseTable)
          let error = null

          if (operation === 'delete') {
            console.log(`[DEBUG] 5. Enviando DELETE para a tabela ${supabaseTable}, ID: ${record_id}`)
            const res = await supabaseClient.delete().eq('id', record_id)
            error = res.error
            console.log(`[DEBUG] Resposta do DELETE:`, res)
          } else {
            console.log(`[DEBUG] 5. Enviando UPSERT para a tabela ${supabaseTable} com os dados:`, data)
            const res = await supabaseClient.upsert(data, { onConflict: 'id' })
            error = res.error
            console.log(`[DEBUG] Resposta do UPSERT:`, res)
          }

          if (error) {
            console.error(`[DEBUG ERROR] Erro retornado pelo Supabase no item ${item.id}:`, error)
            alert(`🚨 ERRO SUPABASE:\nTabela: ${table}\nDetalhe: ${error.message}`)
            throw new Error(error.message)
          }

          console.log(`[DEBUG] 6. SUCESSO! Removendo item ${item.id} da fila local.`)
          await removeFromSyncQueue(item.id)

        } catch (err: any) {
          console.error('[DEBUG ERROR] Falha ao processar o item específico:', err)
          await markSyncFailed(item.id, err.message)
        }
      }

      await updatePendingCount()
      if (pendingCount === 0) setSyncStatus(isOnline ? 'online' : 'offline')

    } catch (err) {
      console.error('[DEBUG ERROR] Erro fatal no processSyncQueue:', err)
    } finally {
      isSyncing.current = false
      console.log('[DEBUG] 7. Sincronização finalizada.')
    }
  }, [user?.id, isOnline, pendingCount, updatePendingCount])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus('online')
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
    if (isOnline) processSyncQueue()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processSyncQueue, showToast])

  const queueOperation = useCallback(async (table: AllTables, operation: 'create' | 'update' | 'delete', recordId: string, data: any) => {
    if (!user?.id) return
    await addToSyncQueue(user.id, table, operation, recordId, data)
    await updatePendingCount()
    if (isOnline) processSyncQueue()
  }, [user?.id, isOnline, updatePendingCount, processSyncQueue])

  const forceSync = useCallback(async () => {
    console.log('[DEBUG] BOTÃO forceSync ACIONADO PELO USUÁRIO!')
    if (!isOnline) {
      showToast('📡 Sem conexão.', 'warning')
      return
    }
    showToast('🔄 Sincronizando...', 'info')
    await processSyncQueue()
    showToast('✅ Sincronização concluída!', 'success')
  }, [isOnline, processSyncQueue, showToast])

  const refreshPendingCount = useCallback(async () => {
    await updatePendingCount()
  }, [updatePendingCount])

  return { syncStatus, isOnline, pendingCount, isSyncing: isSyncing.current, queueOperation, forceSync, refreshPendingCount }
}
