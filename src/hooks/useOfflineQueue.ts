'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { db, removeFromSyncQueue, markSyncFailed } from '@/lib/db'

interface QueuedTransaction {
  id: string
  payload: any
  timestamp: number
}

// Depois de N tentativas falhas, paramos de tentar pra sempre e marcamos
// o registro local como 'failed' — evita ficar reprocessando um erro de
// RLS/validação em loop infinito, e evita bloquear o pull do
// useLocalData indefinidamente com um sync_status: 'pending' que nunca
// vai confirmar.
const MAX_SYNC_ATTEMPTS = 5

export function useOfflineQueue() {
  const { user } = useAuth()
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const updatePendingCount = useCallback(async () => {
    const legacyQueue: QueuedTransaction[] = JSON.parse(localStorage.getItem('tx_queue') || '[]')

    let dexieCount = 0
    if (user?.id) {
      try {
        dexieCount = await db.syncQueue.where('user_id').equals(user.id).count()
      } catch {
        dexieCount = 0
      }
    }

    setPendingCount(legacyQueue.length + dexieCount)
  }, [user?.id])

  // ============================================================
  // FILA LEGADA (localStorage) — mantida 100% como estava.
  // Usada por telas que chamam saveToQueue() diretamente para
  // criar transações offline (fora do fluxo do safeAdd/db.syncQueue).
  // ============================================================
  const saveToQueue = async (payload: any) => {
    const queue: QueuedTransaction[] = JSON.parse(localStorage.getItem('tx_queue') || '[]')

    const enrichedPayload = {
      ...payload,
      idempotency_key: payload.idempotency_key || crypto.randomUUID(),
    }

    queue.push({
      id: crypto.randomUUID(),
      payload: enrichedPayload,
      timestamp: Date.now()
    })

    queue.sort((a, b) => a.timestamp - b.timestamp)

    localStorage.setItem('tx_queue', JSON.stringify(queue))
    await updatePendingCount()

    if (navigator.onLine) {
      syncQueue()
    }
  }

  // ============================================================
  // 🔥 NOVO: PROCESSADOR GENÉRICO DA FILA REAL (db.syncQueue)
  //
  // BUG ENCONTRADO (causa raiz do "efeito rebote"):
  // addToSyncQueue() — chamado por safeAdd/safeUpdate/safeDelete em
  // TODAS as telas (categorias, contas, dívidas, orçamentos etc.) —
  // grava na tabela Dexie "syncQueue". Só que NADA neste hook lia
  // essa tabela. Ele só processava a fila #1 (localStorage), que só
  // faz INSERT e só na tabela "transactions".
  //
  // Resultado prático: qualquer UPDATE ou DELETE (e qualquer CREATE
  // fora de "transactions") ficava enfileirado localmente para
  // sempre e NUNCA era enviado ao Supabase. As edições de categoria
  // nunca "pegavam" no servidor — daí os zumbis nunca morrerem de
  // verdade, mesmo com a faxina corrigida.
  //
  // Esta função processa db.syncQueue de forma genérica, para
  // qualquer tabela e qualquer operação (create/update/delete).
  // ============================================================
  const processDexieQueue = useCallback(async () => {
    if (!user?.id || !navigator.onLine) return

    let items: any[] = []
    try {
      items = await db.syncQueue.where('user_id').equals(user.id).sortBy('created_at')
    } catch (e) {
      console.error('Erro ao ler fila de sincronização (db.syncQueue):', e)
      return
    }

    if (items.length === 0) return

    for (const item of items) {
      try {
        let error: any = null

        if (item.operation === 'create') {
          const { error: insertError } = await supabase
            .from(item.table)
            .insert([{ ...item.data, id: item.record_id }])
          error = insertError
        } else if (item.operation === 'update') {
          const { error: updateError } = await supabase
            .from(item.table)
            .update(item.data)
            .eq('id', item.record_id)
            .eq('user_id', user.id) // 🔥 garante que a RLS reconheça o dono
          error = updateError
        } else if (item.operation === 'delete') {
          const { error: deleteError } = await supabase
            .from(item.table)
            .delete()
            .eq('id', item.record_id)
            .eq('user_id', user.id)
          error = deleteError
        }

        if (error) {
          console.error(`Erro ao sincronizar ${item.table}/${item.operation} (${item.record_id}):`, error.message)
          await markSyncFailed(item.id, error.message)

          const attempts = (item.attempts || 0) + 1
          if (attempts >= MAX_SYNC_ATTEMPTS && item.operation !== 'delete') {
            // Para de tentar e sinaliza no próprio registro que a
            // sincronização falhou definitivamente — assim ele fica
            // visível (você pode expor sync_status: 'failed' na UI)
            // em vez de ficar preso em 'pending' pra sempre.
            try {
              await db.table(item.table).update(item.record_id, { sync_status: 'failed' })
            } catch { /* registro pode já não existir mais localmente */ }
          }
          continue
        }

        // Sucesso: confirma o registro local como sincronizado
        if (item.operation !== 'delete') {
          try {
            await db.table(item.table).update(item.record_id, { sync_status: 'synced' })
          } catch { /* registro pode ter sido removido localmente nesse meio tempo */ }
        }

        await removeFromSyncQueue(item.id)
      } catch (err: any) {
        console.error(`Erro inesperado ao processar item da fila (${item.table}):`, err)
        await markSyncFailed(item.id, err.message || 'Erro desconhecido')
      }
    }

    await updatePendingCount()
  }, [user?.id, updatePendingCount])

  // ============================================================
  // syncQueue() — agora processa AS DUAS filas
  // ============================================================
  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return

    setIsSyncing(true)

    // 1) Fila legada (localStorage) — só criação de transações
    const queue: QueuedTransaction[] = JSON.parse(localStorage.getItem('tx_queue') || '[]')
    const remaining: QueuedTransaction[] = []

    for (const item of queue) {
      try {
        if (item.payload.idempotency_key) {
          const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('idempotency_key', item.payload.idempotency_key)
            .maybeSingle()

          if (existing) {
            continue
          }
        }

        const { error } = await supabase.from('transactions').insert([item.payload])
        if (error) {
          console.error('Erro ao sincronizar:', error)
          remaining.push(item)
        }
      } catch (err) {
        console.error('Erro na sincronização:', err)
        remaining.push(item)
      }
    }

    localStorage.setItem('tx_queue', JSON.stringify(remaining))

    // 2) 🔥 Fila real (Dexie syncQueue) — todas as demais tabelas/operações
    await processDexieQueue()

    setIsSyncing(false)
    await updatePendingCount()

    if (remaining.length < queue.length) {
      window.dispatchEvent(new CustomEvent('queue-synced'))
    }
  }, [processDexieQueue, updatePendingCount])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    updatePendingCount()

    const handleOnline = () => {
      setIsOnline(true)
      syncQueue()
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if (navigator.onLine) {
      syncQueue()
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncQueue, updatePendingCount])

  return { isOnline, pendingCount, isSyncing, saveToQueue, syncQueue }
}
