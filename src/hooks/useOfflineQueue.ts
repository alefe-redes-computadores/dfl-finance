'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/hooks/useAuth'
import { db } from '@/lib/db'

interface QueuedTransaction {
  id: string
  payload: any
  timestamp: number
}

export function useOfflineQueue() {
  const { user } = useAuth()
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true)
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
  // FILA LEGADA (localStorage)
  // Mantida apenas para retrocompatibilidade.
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
  // syncQueue() — Agora processa APENAS a fila legada
  // A fila real (Dexie) é processada exclusivamente pelo useLocalSync
  // ============================================================
  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return

    setIsSyncing(true)

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
            continue // Já existe, ignora e não recoloca na fila
          }
        }

        const { error } = await supabase.from('transactions').insert([item.payload])
        if (error) {
          console.error('Erro ao sincronizar fila legada:', error)
          remaining.push(item) // Falhou, mantém na fila
        }
      } catch (err) {
        console.error('Erro na sincronização da fila legada:', err)
        remaining.push(item)
      }
    }

    localStorage.setItem('tx_queue', JSON.stringify(remaining))

    setIsSyncing(false)
    await updatePendingCount()

    if (remaining.length < queue.length) {
      window.dispatchEvent(new CustomEvent('queue-synced'))
    }
  }, [updatePendingCount])

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
