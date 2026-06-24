'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface QueuedTransaction {
  id: string
  payload: any
  timestamp: number
}

export function useOfflineQueue() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => { 
      setIsOnline(true)
      syncQueue() 
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    updatePendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const saveToQueue = async (payload: any) => {
    const queue: QueuedTransaction[] = JSON.parse(localStorage.getItem('tx_queue') || '[]')
    queue.push({
      id: crypto.randomUUID(),
      payload,
      timestamp: Date.now()
    })
    localStorage.setItem('tx_queue', JSON.stringify(queue))
    setPendingCount(queue.length)
  }

  const syncQueue = async () => {
    const queue: QueuedTransaction[] = JSON.parse(localStorage.getItem('tx_queue') || '[]')
    if (queue.length === 0) return

    const remaining: QueuedTransaction[] = []

    for (const item of queue) {
      try {
        const { error } = await supabase.from('transactions').insert([item.payload])
        if (error) {
          remaining.push(item)
        }
      } catch (err) {
        remaining.push(item)
      }
    }

    localStorage.setItem('tx_queue', JSON.stringify(remaining))
    setPendingCount(remaining.length)
  }

  const updatePendingCount = () => {
    const queue: QueuedTransaction[] = JSON.parse(localStorage.getItem('tx_queue') || '[]')
    setPendingCount(queue.length)
  }

  return { isOnline, pendingCount, saveToQueue, syncQueue }
}
