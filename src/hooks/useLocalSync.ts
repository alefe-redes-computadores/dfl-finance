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
    // 🔔 PASSO 1: O motor foi chamado?
    alert('👉 PASSO 1: processSyncQueue foi acionado!')
    
    if (!user?.id) { alert('❌ Parou: Usuário não identificado no useAuth'); return }
    if (isSyncing.current) { alert('⚠️ Parou: Já existe um sincronismo em execução (bloqueado)'); return }
    if (!isOnline) { alert('❌ Parou: O navegador acha que está offline'); return }

    isSyncing.current = true
    setSyncStatus('syncing')

    try {
      // 🔔 PASSO 2: Vai tentar ler o Dexie
      alert('👉 PASSO 2: Tentando buscar itens pendentes no Dexie...');
      const items = await getPendingSyncItems(user.id)
      
      // 🔔 PASSO 3: Quantos itens leu?
      alert(`👉 PASSO 3: Dexie respondeu! Itens encontrados na fila: ${items.length}`)

      if (items.length === 0) {
        setSyncStatus(isOnline ? 'online' : 'offline')
        isSyncing.current = false
        return
      }

      for (const item of items) {
        try {
          const { table, operation, record_id, data } = item
          
          let supabaseTable: string = table
          if (table === 'credit_cards') supabaseTable = 'credit_cards'
          if (table === 'credit_invoices') supabaseTable = 'credit_invoices'

          // 🔔 PASSO 4: Vai disparar para o Supabase
          alert(`👉 PASSO 4: Enviando ${operation} da tabela ${table} para o Supabase...`)

          const supabaseClient = supabase.from(supabaseTable)
          let error = null

          if (operation === 'delete') {
            const res = await supabaseClient.delete().eq('id', record_id)
            error = res.error
          } else {
            const res = await supabaseClient.upsert(data, { onConflict: 'id' })
            error = res.error
          }

          if (error) {
            // 🔔 ALERTA DE ERRO REAL DO SUPABASE
            alert(`🚨 ERRO DO SUPABASE!\nTabela: ${table}\nMensagem: ${error.message}\nCódigo: ${error.code}`)
            throw new Error(error.message)
          }

          // 🔔 PASSO 5: Sucesso no item
          alert(`✅ PASSO 5: Item ${record_id} enviado com sucesso! Removendo da fila local...`)
          await removeFromSyncQueue(item.id)

        } catch (err: any) {
          await markSyncFailed(item.id, err.message)
        }
      }

      await updatePendingCount()
      if (pendingCount === 0) setSyncStatus(isOnline ? 'online' : 'offline')

    } catch (err: any) {
      alert(`💥 ERRO CRÍTICO NO PROCESSO:\n${err?.message || err}`)
    } finally {
      isSyncing.current = false
      alert('🏁 PASSO 7: Fim do ciclo de sincronização.')
    }
  }, [user?.id, isOnline, pendingCount, updatePendingCount])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus('online')
      processSyncQueue()
    }
    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (isOnline) processSyncQueue()
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [processSyncQueue])

  const queueOperation = useCallback(async (table: AllTables, operation: 'create' | 'update' | 'delete', recordId: string, data: any) => {
    if (!user?.id) return
    await addToSyncQueue(user.id, table, operation, recordId, data)
    await updatePendingCount()
    if (isOnline) processSyncQueue()
  }, [user?.id, isOnline, updatePendingCount, processSyncQueue])

  const forceSync = useCallback(async () => {
    if (!isOnline) {
      showToast('📡 Sem conexão.', 'warning')
      return
    }
    await processSyncQueue()
  }, [isOnline, processSyncQueue])

  const refreshPendingCount = useCallback(async () => {
    await updatePendingCount()
  }, [updatePendingCount])

  return { syncStatus, isOnline, pendingCount, isSyncing: isSyncing.current, queueOperation, forceSync, refreshPendingCount }
}
