'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface QueuedTransaction {
  id: string
  payload: any
  timestamp: number
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const updatePendingCount = useCallback(() => {
    const queue: QueuedTransaction[] = JSON.parse(localStorage.getItem('tx_queue') || '[]')
    setPendingCount(queue.length)
  }, [])

  const saveToQueue = async (payload: any) => {
    const queue: QueuedTransaction[] = JSON.parse(localStorage.getItem('tx_queue') || '[]')
    
    // Garantir idempotency_key se não existir
    const enrichedPayload = {
      ...payload,
      idempotency_key: payload.idempotency_key || crypto.randomUUID(),
    }

    queue.push({
      id: crypto.randomUUID(),
      payload: enrichedPayload,
      timestamp: Date.now()
    })

    // Ordenar por timestamp (mais antigos primeiro)
    queue.sort((a, b) => a.timestamp - b.timestamp)

    localStorage.setItem('tx_queue', JSON.stringify(queue))
    setPendingCount(queue.length)

    // Se voltou a ter internet, tenta sincronizar imediatamente
    if (navigator.onLine) {
      syncQueue()
    }
  }

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine) return
    
    const queue: QueuedTransaction[] = JSON.parse(localStorage.getItem('tx_queue') || '[]')
    if (queue.length === 0) return

    setIsSyncing(true)
    const remaining: QueuedTransaction[] = []

    for (const item of queue) {
      try {
        // Verificar duplicidade antes de inserir
        if (item.payload.idempotency_key) {
          const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('idempotency_key', item.payload.idempotency_key)
            .maybeSingle()

          if (existing) {
            // Já existe, pular
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
    setPendingCount(remaining.length)
    setIsSyncing(false)

    // Recarregar dados se algo foi sincronizado
    if (remaining.length < queue.length) {
      window.dispatchEvent(new CustomEvent('queue-synced'))
    }
  }, [])

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

    // Sincronizar ao iniciar se estiver online
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