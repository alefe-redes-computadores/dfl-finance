// src/hooks/useLocalSync.ts
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { db, addToSyncQueue, getPendingSyncItems, removeFromSyncQueueIfCurrent, markSyncFailedIfCurrent } from '@/lib/db'
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
    if (!user?.id) {
      setPendingCount(0)
      return 0
    }

    const items = await getPendingSyncItems(user.id)
    const count = items.length
    setPendingCount(count)
    return count
  }, [user?.id])

  // ✅ NOVA LÓGICA: Puxar dados remotos (do Bot/Supabase) para o celular
  // ✅ CORRIGIDO (parte 1): aceita um parâmetro opcional "force". Para CADA
  // tabela, se o Dexie local estiver vazio para aquele usuário, ignora o
  // "lastPull" salvo e busca TUDO do zero (full resync daquela tabela).
  //
  // ✅ CORRIGIDO (parte 2 — ESTA É A CORREÇÃO PRINCIPAL DESTA RODADA):
  // a lista tablesToPull estava com só 4 tabelas ('transactions', 'accounts',
  // 'categories', 'credit_cards'). Isso fazia com que debts, budgets, goals,
  // loans, financings, subscriptions, tags, contacts, credit_invoices e
  // notifications NUNCA fossem puxadas da nuvem — mesmo existindo lá, com
  // schema correto e sem erro de RLS. Agora a lista cobre todas as tabelas
  // do app que fazem sentido sincronizar via pull.
  const pullRemoteChanges = useCallback(async (force = false) => {
    if (!user?.id || !isOnline) return
    renderLog(`Iniciando PULL da nuvem${force ? ' (FORÇADO / FULL RESYNC)' : ''}...`, 'info')

    try {
      const lastPullKey = `dfl_last_pull_${user.id}`
      const storedLastPull = localStorage.getItem(lastPullKey) || '2000-01-01T00:00:00.000Z'
      const syncTime = new Date().toISOString()
      const failedTables: AllTables[] = []

      // ✅ Lista ampliada — agora cobre todas as tabelas sincronizáveis do app.
      // chat_history e chat_sessions ficam de fora de propósito: são
      // conversas do bot/assistente e não fazem sentido no pull genérico.
      const tablesToPull: AllTables[] = [
        'transactions',
        'accounts',
        'categories',
        'credit_cards',
        'debts',
        'loans',
        'financings',
        'subscriptions',
        'tags',
        'contacts',
        'budgets',
        'goals',
        'credit_invoices',
        'notifications',
      ]

      for (const tableName of tablesToPull) {
        // Verifica se a tabela local está vazia para este usuário.
        // Se estiver (ou se force=true), ignora o cutoff salvo e busca tudo.
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
          failedTables.push(tableName)
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

      // So avanca o cutoff se todas as tabelas concluirem.
      if (failedTables.length === 0) {
        localStorage.setItem(lastPullKey, syncTime)
        renderLog('PULL finalizado com sucesso.', 'success')
      } else {
        renderLog(
          `PULL parcial: ${failedTables.length} tabela(s) falharam. lastPull preservado para nova tentativa.`,
          'error'
        )
      }

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
              renderLog(
                `Item ${item.id} ja falhou ${attempts} vezes e continuara pendente para nova tentativa.`,
                'error'
              )
            }

            const { table, operation, record_id, data } = item
            const itemRevision = item.revision ?? 0
            
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

            const removed = await removeFromSyncQueueIfCurrent(
              item.id,
              itemRevision
            )

            if (removed) {
              renderLog(`Sucesso no ID ${record_id}. Item removido da fila local.`, 'success')
              console.log(`✅ [SYNC] Item ${item.id} sincronizado com sucesso.`)
            } else {
              renderLog(
                `Sucesso remoto no ID ${record_id}, mas existe uma revisao local mais nova. Mantendo item na fila.`,
                'info'
              )
              console.log(
                `[SYNC] Item ${item.id} mudou durante o envio e permanecera pendente.`
              )
            }

            await updatePendingCount()

          } catch (err: any) {
            renderLog(`Falha no item: ${err.message}`, 'error')
            console.error(`❌ [SYNC] Falha no item ${item.id}:`, err)
            
            const failureRecorded = await markSyncFailedIfCurrent(
              item.id,
              item.revision ?? 0,
              err.message
            )

            if (failureRecorded) {
              const newAttempts = (item.attempts || 0) + 1
              renderLog(
                `Item mantido na fila apos ${newAttempts} tentativa(s) para evitar perda silenciosa de sincronizacao.`,
                'error'
              )
            } else {
              renderLog(
                `Falha pertence a uma revisao antiga do item ${item.id}; uma revisao mais nova continua pendente.`,
                'info'
              )
            }
          }
        }
      }

      // PASSO 2: PUXAR (PULL) OS DADOS DO WHATSAPP / NUVEM PARA O CELULAR
      await pullRemoteChanges(forcePull)

      await updatePendingCount()
      setSyncStatus(isOnline ? 'online' : 'offline')

    } catch (err: any) {
      renderLog(`Erro crítico na fila: ${err?.message}`, 'error')
      console.error('❌ [SYNC] Erro crítico:', err)
    } finally {
      isSyncing.current = false
      renderLog('Ciclo de sincronização finalizado.', 'info')
    }
  }, [user?.id, isOnline, updatePendingCount, pullRemoteChanges])

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

  // Força uma ressincronização completa, ignorando qualquer "lastPull" salvo —
  // útil como botão de emergência ("Ressincronizar tudo").
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
