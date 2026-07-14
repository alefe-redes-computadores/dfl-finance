// src/hooks/useTransactionsList.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useTransactionsList(
  context?: 'dfl' | 'personal',
  filters?: Record<string, any>,
  startDate?: string | null,
  endDate?: string | null
) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    let items = await db.transactions
      .where('user_id')
      .equals(user.id)
      .toArray()

    // Filtra por contexto
    if (context) {
      items = items.filter((item) => item.context === context)
    }

    // Filtros adicionais
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          items = items.filter((item) => item[key] === value)
        }
      })
    }

    // Filtra por período
    if (startDate) {
      items = items.filter((item) => item.date >= startDate)
    }
    if (endDate) {
      items = items.filter((item) => item.date <= endDate)
    }

    // Ordena por data (mais recente primeiro)
    return items.sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0
      const bTime = b.date ? new Date(b.date).getTime() : 0
      return bTime - aTime
    })
  }, [user?.id, context, JSON.stringify(filters), startDate, endDate])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}