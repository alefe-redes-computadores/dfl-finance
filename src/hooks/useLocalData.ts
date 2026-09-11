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

type IndexCandidate = {
  index: string
  keys: string[]
}

const INDEX_CANDIDATES: Partial<Record<AllTables, IndexCandidate[]>> = {
  transactions: [
    { index: '[user_id+debt_id]', keys: ['debt_id'] },
    { index: '[user_id+account_id]', keys: ['account_id'] },
    { index: '[user_id+credit_card_id]', keys: ['credit_card_id'] },
    { index: '[user_id+contact_id]', keys: ['contact_id'] },
    { index: '[user_id+goal_id]', keys: ['goal_id'] },
    { index: '[user_id+loan_id]', keys: ['loan_id'] },
    { index: '[user_id+financing_id]', keys: ['financing_id'] },
    { index: '[user_id+context]', keys: ['context'] },
    { index: '[user_id+status]', keys: ['status'] },
  ],
  accounts: [
    { index: '[user_id+context]', keys: ['context'] },
  ],
  categories: [
    { index: '[user_id+context]', keys: ['context'] },
    { index: '[user_id+type]', keys: ['type'] },
  ],
  debts: [
    { index: '[user_id+context]', keys: ['context'] },
    { index: '[user_id+status]', keys: ['status'] },
  ],
  loans: [
    { index: '[user_id+context]', keys: ['context'] },
    { index: '[user_id+status]', keys: ['status'] },
  ],
  financings: [
    { index: '[user_id+context]', keys: ['context'] },
    { index: '[user_id+status]', keys: ['status'] },
  ],
  subscriptions: [
    { index: '[user_id+context]', keys: ['context'] },
    { index: '[user_id+status]', keys: ['status'] },
  ],
  tags: [
    { index: '[user_id+context]', keys: ['context'] },
  ],
  contacts: [
    { index: '[user_id+context]', keys: ['context'] },
    { index: '[user_id+type]', keys: ['type'] },
  ],
  budgets: [
    { index: '[user_id+context]', keys: ['context'] },
  ],
  goals: [
    { index: '[user_id+context]', keys: ['context'] },
    { index: '[user_id+status]', keys: ['status'] },
  ],
  credit_cards: [
    { index: '[user_id+context]', keys: ['context'] },
  ],
  credit_invoices: [
    { index: '[user_id+credit_card_id]', keys: ['credit_card_id'] },
    { index: '[user_id+status]', keys: ['status'] },
  ],
  notifications: [
    { index: '[user_id+read]', keys: ['read'] },
  ],
  chat_history: [
    { index: '[user_id+session_id]', keys: ['session_id'] },
  ],
  chat_sessions: [
    { index: '[user_id+status]', keys: ['status'] },
  ],
}

function isActiveFilter(value: unknown) {
  return value !== undefined && value !== null && value !== ''
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

  const filtersKey = useMemo(
    () => JSON.stringify(filters || {}),
    [filters]
  )

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    const activeFilters = Object.entries(filters).filter(
      ([key, value]) =>
        key !== 'user_id' &&
        isActiveFilter(value)
    )

    const candidate = (INDEX_CANDIDATES[table] || []).find(
      ({ keys }) =>
        keys.every((key) => isActiveFilter(filters[key]))
    )

    const tableRef: any = db.table(table)

    let results: any[]

    if (candidate) {
      results = await tableRef
        .where(candidate.index)
        .equals([
          user.id,
          ...candidate.keys.map((key) => filters[key]),
        ])
        .toArray()
    } else {
      results = await tableRef
        .where('user_id')
        .equals(user.id)
        .toArray()
    }

    if (activeFilters.length > 0) {
      results = results.filter((item: any) =>
        activeFilters.every(
          ([key, value]) => item[key] === value
        )
      )
    }

    if (orderBy) {
      results = [...results].sort((a: any, b: any) => {
        const valA = a?.[orderBy]
        const valB = b?.[orderBy]

        if (
          ['date', 'created_at', 'updated_at', 'due_date'].includes(
            orderBy
          )
        ) {
          const dateA =
            typeof valA === 'string' ? valA : ''
          const dateB =
            typeof valB === 'string' ? valB : ''

          return orderDir === 'desc'
            ? dateB.localeCompare(dateA)
            : dateA.localeCompare(dateB)
        }

        if (
          typeof valA === 'number' &&
          typeof valB === 'number'
        ) {
          return orderDir === 'desc'
            ? valB - valA
            : valA - valB
        }

        return orderDir === 'desc'
          ? String(valB ?? '').localeCompare(
              String(valA ?? '')
            )
          : String(valA ?? '').localeCompare(
              String(valB ?? '')
            )
      })
    }

    if (limit && limit > 0) {
      results = results.slice(0, limit)
    }

    return results as T[]
  }, [
    user?.id,
    table,
    filtersKey,
    limit,
    orderBy,
    orderDir,
    refreshKey,
  ])

  const reload = useCallback(async () => {
    setRefreshKey((key) => key + 1)
  }, [])

  return {
    data: data ?? [],
    loading: data === undefined,
    reload,
  }
}
