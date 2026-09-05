// src/hooks/useConciQueue.ts
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
  pending: number
  processed: number
  hydrated: boolean
  isComplete: boolean
  approve: () => void
  reject: () => void
  skip: () => void
  reset: (transactions: Omit<ConciTransaction, 'id' | 'status'>[]) => void
  clear: () => void
  getStats: () => { approved: number; rejected: number; pending: number }
}

const STORAGE_KEY = 'conciliation_queue'

function findNextPending(queue: ConciTransaction[], afterIndex: number) {
  const next = queue.findIndex((item, index) => index > afterIndex && item.status === 'pending')
  if (next >= 0) return next
  return queue.findIndex((item) => item.status === 'pending')
}

export function useConciQueue(): UseConciQueueReturn {
  const [queue, setQueue] = useState<ConciTransaction[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as ConciTransaction[]
        const safeQueue = Array.isArray(parsed) ? parsed : []
        setQueue(safeQueue)
        const firstPending = safeQueue.findIndex((item) => item.status === 'pending')
        setCurrentIndex(firstPending >= 0 ? firstPending : safeQueue.length)
      } catch {
        localStorage.removeItem(STORAGE_KEY)
        setQueue([])
        setCurrentIndex(0)
      }
    }

    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return

    if (queue.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [queue, hydrated])

  const approved = useMemo(() => queue.filter((item) => item.status === 'approved').length, [queue])
  const rejected = useMemo(() => queue.filter((item) => item.status === 'rejected').length, [queue])
  const pending = useMemo(() => queue.filter((item) => item.status === 'pending').length, [queue])
  const total = queue.length
  const processed = approved + rejected
  const isComplete = hydrated && total > 0 && pending === 0
  const current = queue[currentIndex]?.status === 'pending' ? queue[currentIndex] : null

  const advance = useCallback((baseQueue: ConciTransaction[], fromIndex: number) => {
    const next = findNextPending(baseQueue, fromIndex)
    setCurrentIndex(next >= 0 ? next : baseQueue.length)
  }, [])

  const approve = useCallback(() => {
    if (!current) return

    setQueue((previous) => {
      const updated = previous.map((item, index) =>
        index === currentIndex ? { ...item, status: 'approved' as const } : item
      )
      advance(updated, currentIndex)
      return updated
    })
  }, [current, currentIndex, advance])

  const reject = useCallback(() => {
    if (!current) return

    setQueue((previous) => {
      const updated = previous.map((item, index) =>
        index === currentIndex ? { ...item, status: 'rejected' as const } : item
      )
      advance(updated, currentIndex)
      return updated
    })
  }, [current, currentIndex, advance])

  const skip = useCallback(() => {
    if (!current) return
    const next = findNextPending(queue, currentIndex)
    setCurrentIndex(next >= 0 ? next : currentIndex)
  }, [current, queue, currentIndex])

  const reset = useCallback((transactions: Omit<ConciTransaction, 'id' | 'status'>[]) => {
    const newQueue: ConciTransaction[] = transactions.map((item) => ({
      ...item,
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
    approved,
    rejected,
    pending,
  }), [approved, rejected, pending])

  return {
    queue,
    current,
    currentIndex,
    total,
    approved,
    rejected,
    pending,
    processed,
    hydrated,
    isComplete,
    approve,
    reject,
    skip,
    reset,
    clear,
    getStats,
  }
}
