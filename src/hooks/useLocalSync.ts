// src/hooks/useLocalSync.ts
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db, addToSyncQueue, getPendingSyncItems, removeFromSyncQueue, markSyncFailed } from '@/lib/db'
import { useToast } from '@/contexts/ToastContext'
import { useIsAdmin } from '@/hooks/useAdmin'

type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline'

type AllTables = 
  | 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' 
  | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' 
  | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications'

export function useLocalSync() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { isAdmin } = useIsAdmin()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)
  const isSyncing = useRef(false)

  const renderLog = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    if (!isAdmin) return
    if (typeof window === 'undefined') return
    
    try {
      window.dispatchEvent(new CustomEvent('admin-log', { 
        detail: { msg, type, timestamp: new Date().toISOString() }
      }))
    } catch (_) {
      // Fallback silencioso se o evento falhar
    }
  }

  const updatePendingCount = useCallback(async () => {
    if (!user?.id) return
    const items = await getPendingSyncItems(user.id)
    setPendingCount(items.length)
  }, [user?.id])

  // ✅ NOVA LÓGICA: Puxar dados remotos (do Bot/Supabase) para o celular
  const pullRemoteChanges = useCallback(async () => {
    if (!user?.id || !isOnline) return
    renderLog('Iniciando PULL da nuvem (Buscando dados do WhatsApp/Externos)...', 'info')

    try {
      const lastPullKey = `dfl_last_pull_${user.id}`
      // Pega a última data de sync ou usa uma data bem antiga se for a primeira vez
      const lastPull = localStorage.getItem(lastPullKey) || '2000-01-01T00:00:00.000Z'
      const syncTime = new Date().toISOString()

      // Tabelas principais que o bot ou outros dispositivos podem alterar
      const tablesToPull: AllTables[] = ['transactions', 'accounts', 'categories', 'credit_cards']

      for (const tableName of tablesToPull) {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('user_id', user.id)
          .gt('updated_at', lastPull) // Busca só o que foi alterado APÓS o último sync

        if (error) {
          renderLog(`Erro ao puxar ${tableName}: ${error.message}`, 'error')
          continue
        }

        if (data && data.length > 0) {
          renderLog(`Baixando ${data.length} atualizações de ${tableName}...`, 'success')
          
          // Formata os dados para garantir que entrem como sincronizados no banco local
          const localData = data.map(item => ({
            ...item,
            sync_status: 'synced',
            sync_attempts: 0
          }))
          
          // bulkPut insere os novos e atualiza os existentes silenciosamente
          await db.table(tableName).bulkPut(localData)
        }
      }

      // Atualiza a marcação de tempo para o próximo pull
      localStorage.setItem(lastPullKey, syncTime)
      renderLog('PULL finalizado com sucesso.', 'success')

    } catch (err: any) {
      renderLog(`Erro crítico no PULL: ${err?.message}`, 'error')
      console.error('❌ [SYNC PULL] Erro:', err)
    }
  }, [user?.id, isOnline, isAdmin])

  const processSyncQueue = useCallback(async () => {
    renderLog('Iniciando processSyncQueue...', 'info')
    
    if (!user?.id) { renderLog('Cancelado: Usuário sem ID logado', 'error'); return }
    if (isSyncing.current) { renderLog('Cancelado: Já existe uma fila rodando', 'info'); return }
    if (!isOnline) { renderLog('Cancelado: Dispositivo detectado como Offline', 'error'); return }

    isSyncing.current = true
    setSyncStatus('syncing')

    try {
      renderLog('Buscando itens pendentes no Dexie...', 'info')
      const items = await getPendingSyncItems(user.id)
      renderLog(`Dexie retornou ${items.length} itens pendentes.`, 'info')

      // PASSO 1: EMPURRAR (PUSH) OS DADOS LOCAIS PARA A NUVEM
      if (items.length > 0) {
        for (const item of items) {
          renderLog(`Processando ${item.operation} na tabela [${item.table}]... (tentativa ${(item.attempts || 0) + 1})`, 'info')
          
          try {
            const attempts = item.attempts || 0
            if (attempts >= 3) {
              renderLog(`⚠️ Item ${item.id} atingiu limite de 3 tentativas. Removendo da fila para desbloquear.`, 'error')
              console.error(`⚠️ [SYNC] Item corrompido removido da fila: ${item.table}/${item.record_id} após ${attempts} tentativas.`)
              await removeFromSyncQueue(item.id)
              await updatePendingCount()
              continue
            }

            const { table, operation, record_id, data } = item
            
            let supabaseTable: string = table
            if (table === 'credit_cards') supabaseTable = 'credit_cards'
            if (table === 'credit_invoices') supabaseTable = 'credit_invoices'

            const supabaseClient = supabase.from(supabaseTable)
            let error = null

            if (operation === 'delete') {
              renderLog(`Disparando DELETE para ID: ${record_id}`, 'info')
              const res = await supabaseClient.delete().eq('id', record_id)
              error = res.error
            } else {
              renderLog(`Disparando UPSERT para ID: ${record_id} (payload contém ID: ${!!data?.id})`, 'info')
              const payload = data?.id ? data : { ...data, id: record_id }
              const res = await supabaseClient.upsert(payload, { onConflict: 'id' })
              error = res.error
            }

            if (error) {
              renderLog(`Erro Supabase: ${error.message} (Código: ${error.code})`, 'error')
              console.error(`❌ [SYNC] Erro no item ${item.id}: ${error.message}`, error)
              throw new Error(error.message)
            }

            renderLog(`Sucesso no ID ${record_id}. Removendo da fila local...`, 'success')
            console.log(`✅ [SYNC] Item ${item.id} sincronizado com sucesso.`)
            await removeFromSyncQueue(item.id)
            await updatePendingCount()

          } catch (err: any) {
            renderLog(`Falha no item: ${err.message}`, 'error')
            console.error(`❌ [SYNC] Falha no item ${item.id}:`, err)
            
            const newAttempts = (item.attempts || 0) + 1
            await markSyncFailed(item.id, err.message)
            
            if (newAttempts >= 3) {
              renderLog(`⚠️ Item ${item.id} atingiu limite de 3 tentativas. Removendo da fila.`, 'error')
              console.error(`⚠️ [SYNC] Item removido após 3 falhas: ${item.table}/${item.record_id}`)
              await removeFromSyncQueue(item.id)
              await updatePendingCount()
            }
          }
        }
      }

      // PASSO 2: PUXAR (PULL) OS DADOS DO WHATSAPP / NUVEM PARA O CELULAR
      await pullRemoteChanges()

      await updatePendingCount()
      if (pendingCount === 0) setSyncStatus(isOnline ? 'online' : 'offline')

    } catch (err: any) {
      renderLog(`Erro crítico na fila: ${err?.message}`, 'error')
      console.error('❌ [SYNC] Erro crítico:', err)
    } finally {
      isSyncing.current = false
      renderLog('Ciclo de sincronização finalizado.', 'info')
    }
  }, [user?.id, isOnline, pendingCount, updatePendingCount, pullRemoteChanges])

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setSyncStatus('online')
      renderLog('🌐 Rede detectou conexão reestabelecida.', 'success')
      processSyncQueue()
    }
    const handleOffline = () => {
      setIsOnline(false)
      setSyncStatus('offline')
      renderLog('📡 Rede detectou queda de conexão.', 'error')
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
    renderLog('Ação manual: Forçar Sincronismo acionado.', 'info')
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
