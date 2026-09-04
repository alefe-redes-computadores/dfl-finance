// src/hooks/useLocalData.ts
'use client'

import { useMemo, useState, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

type AllTables =
  | 'transactions'
  | 'accounts'
  | 'categories'
  | 'debts'
  | 'loans'
  | 'financings'
  | 'subscriptions'
  | 'tags'
  | 'contacts'
  | 'budgets'
  | 'goals'
  | 'credit_cards'
  | 'credit_invoices'
  | 'notifications'
  | 'chat_history'
  | 'chat_sessions'

interface UseLocalDataProps {
  table: AllTables
  filters?: Record<string, any>
  limit?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
}

export function useLocalData<T = any>({
  table,
  filters = {},
  limit,
  orderBy = 'date',
  orderDir = 'desc',
}: UseLocalDataProps) {
  const { user } = useAuth()
  const [refreshKey, setRefreshKey] = useState(0)

  const filtersKey = useMemo(() => JSON.stringify(filters || {}), [filters])

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    let results = await db.table(table)
      .where('user_id')
      .equals(user.id)
      .toArray()

    const activeFilters = Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )

    if (activeFilters.length > 0) {
      results = results.filter((item: any) =>
        activeFilters.every(([key, value]) => item[key] === value)
      )
    }

    if (orderBy) {
      results = [...results].sort((a: any, b: any) => {
        const valA = a?.[orderBy]
        const valB = b?.[orderBy]

        if (['date', 'created_at', 'updated_at', 'due_date'].includes(orderBy)) {
          const dateA = typeof valA === 'string' ? valA : ''
          const dateB = typeof valB === 'string' ? valB : ''

          return orderDir === 'desc'
            ? dateB.localeCompare(dateA)
            : dateA.localeCompare(dateB)
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          return orderDir === 'desc' ? valB - valA : valA - valB
        }

        return orderDir === 'desc'
          ? String(valB ?? '').localeCompare(String(valA ?? ''))
          : String(valA ?? '').localeCompare(String(valB ?? ''))
      })
    }

    if (limit && limit > 0) {
      results = results.slice(0, limit)
    }

    return results as T[]
  }, [user?.id, table, filtersKey, limit, orderBy, orderDir, refreshKey])

  const reload = useCallback(async () => {
    setRefreshKey((k) => k + 1)
  }, [])

  return {
    data: data ?? [],
    loading: data === undefined,
    reload,
  }
}