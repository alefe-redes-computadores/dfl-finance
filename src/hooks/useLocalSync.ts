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
  // ✅ CORRIGIDO: aceita um parâmetro opcional "force". Além disso, para CADA
  // tabela, se o Dexie local estiver vazio para aquele usuário, ignora o
  // "lastPull" salvo e busca TUDO do zero. Isso evita o cenário onde o
  // localStorage guarda um timestamp recente (de uma tentativa de pull
  // anterior que não trouxe nada, por erro de RLS, contexto, etc.) e o app
  // fica preso para sempre perguntando "o que mudou depois disso", sem nunca
  // buscar os registros antigos que já existiam na nuvem.
  const pullRemoteChanges = useCallback(async (force = false) => {
    if (!user?.id || !isOnline) return
    renderLog(`Iniciando PULL da nuvem${force ? ' (FORÇADO / FULL RESYNC)' : ''}...`, 'info')

    try {
      const lastPullKey = `dfl_last_pull_${user.id}`
      const storedLastPull = localStorage.getItem(lastPullKey) || '2000-01-01T00:00:00.000Z'
      const syncTime = new Date().toISOString()

      // Tabelas principais que o bot ou outros dispositivos podem alterar
      const tablesToPull: AllTables[] = ['transactions', 'accounts', 'categories', 'credit_cards']

      for (const tableName of tablesToPull) {
        // ✅ Verifica se a tabela local está vazia para este usuário.
        // Se estiver, ignora o cutoff salvo e busca tudo (full resync daquela tabela).
        let effectiveLastPull = storedLastPull
        try {
          const localCount = await db.table(tableName).where('user_id').equals(user.id).count()
          if (force || localCount === 0) {
            effectiveLastPull = '2000-01-01T00:00:00.000Z'
            renderLog(
              `Tabela [${tableName}] vazia localmente (ou força ativa) — buscando histórico completo.`,
              'info'
            )
          }
        } catch (countErr: any) {
          // Se por algum motivo a contagem falhar, joga pro modo seguro (full fetch)
          effectiveLastPull = '2000-01-01T00:00:00.000Z'
        }

        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('user_id', user.id)
          .gt('updated_at', effectiveLastPull)

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
        } else {
          renderLog(`Nenhuma atualização em ${tableName}.`, 'info')
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

  const processSyncQueue = useCallback(async (forcePull = false) => {
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
      await pullRemoteChanges(forcePull)

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
    await processSyncQueue(false)
  }, [isOnline, processSyncQueue])

  const forceFullResync = useCallback(async () => {
    renderLog('Ação manual: Ressincronização COMPLETA acionada.', 'info')
    if (!isOnline) {
      showToast('📡 Sem conexão.', 'warning')
      return
    }
    if (user?.id) {
      localStorage.removeItem(`dfl_last_pull_${user.id}`)
    }
    await processSyncQueue(true)
    showToast('✅ Ressincronização completa concluída.', 'success')
  }, [isOnline, processSyncQueue, user?.id, showToast])

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
    forceFullResync,
    refreshPendingCount,
  }
}
