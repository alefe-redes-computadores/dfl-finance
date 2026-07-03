// src/hooks/useConciQueue.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'

export interface ConciTransaction {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  categorySuggestion?: string
  accountName?: string
  accountId?: string
  context?: 'dfl' | 'personal'
  source?: 'csv' | 'ocr' | 'manual'
  status: 'pending' | 'approved' | 'rejected'
  originalData?: any
}

interface UseConciQueueReturn {
  queue: ConciTransaction[]
  current: ConciTransaction | null
  currentIndex: number
  total: number
  approved: number
  rejected: number
  isComplete: boolean
  approve: () => void
  reject: () => void
  skip: () => void
  reset: (transactions: Omit<ConciTransaction, 'id' | 'status'>[]) => void
  clear: () => void
  getStats: () => { approved: number; rejected: number; pending: number }
}

const STORAGE_KEY = 'conciliation_queue'

export function useConciQueue(): UseConciQueueReturn {
  const [queue, setQueue] = useState<ConciTransaction[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setQueue(parsed)
        const firstPending = parsed.findIndex((t: ConciTransaction) => t.status === 'pending')
        setCurrentIndex(firstPending >= 0 ? firstPending : parsed.length)
      } catch {
        setQueue([])
      }
    }
  }, [])

  useEffect(() => {
    if (queue.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [queue])

  const current = queue[currentIndex] || null
  const total = queue.filter(t => t.status === 'pending').length
  const approved = queue.filter(t => t.status === 'approved').length
  const rejected = queue.filter(t => t.status === 'rejected').length
  const isComplete = total === 0 && queue.length > 0

  const approve = useCallback(() => {
    if (!current || current.status !== 'pending') return
    setQueue(prev => {
      const updated = [...prev]
      updated[currentIndex] = { ...updated[currentIndex], status: 'approved' }
      return updated
    })
    setCurrentIndex(prev => {
      const next = queue.findIndex((t, i) => i > prev && t.status === 'pending')
      return next >= 0 ? next : queue.length
    })
  }, [current, currentIndex, queue])

  const reject = useCallback(() => {
    if (!current || current.status !== 'pending') return
    setQueue(prev => {
      const updated = [...prev]
      updated[currentIndex] = { ...updated[currentIndex], status: 'rejected' }
      return updated
    })
    setCurrentIndex(prev => {
      const next = queue.findIndex((t, i) => i > prev && t.status === 'pending')
      return next >= 0 ? next : queue.length
    })
  }, [current, currentIndex, queue])

  const skip = useCallback(() => {
    if (!current) return
    setCurrentIndex(prev => {
      const next = queue.findIndex((t, i) => i > prev && t.status === 'pending')
      return next >= 0 ? next : queue.length
    })
  }, [current, queue])

  const reset = useCallback((transactions: Omit<ConciTransaction, 'id' | 'status'>[]) => {
    const newQueue: ConciTransaction[] = transactions.map(t => ({
      ...t,
      id: uuidv4(),
      status: 'pending',
    }))
    setQueue(newQueue)
    setCurrentIndex(0)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue))
  }, [])

  const clear = useCallback(() => {
    setQueue([])
    setCurrentIndex(0)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const getStats = useCallback(() => ({
    approved: queue.filter(t => t.status === 'approved').length,
    rejected: queue.filter(t => t.status === 'rejected').length,
    pending: queue.filter(t => t.status === 'pending').length,
  }), [queue])

  return {
    queue,
    current,
    currentIndex,
    total,
    approved,
    rejected,
    isComplete,
    approve,
    reject,
    skip,
    reset,
    clear,
    getStats,
  }
}