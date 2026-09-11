// src/hooks/useTransactionsList.ts
'use client'

import Dexie from 'dexie'
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
  const filtersKey = JSON.stringify(filters || {})

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    let items

    if (context && (startDate || endDate)) {
      items = await db.transactions
        .where('[user_id+context+date]')
        .between(
          [
            user.id,
            context,
            startDate || Dexie.minKey,
          ],
          [
            user.id,
            context,
            endDate || Dexie.maxKey,
          ],
          true,
          true
        )
        .toArray()
    } else if (context) {
      items = await db.transactions
        .where('[user_id+context]')
        .equals([user.id, context])
        .toArray()
    } else if (startDate || endDate) {
      items = await db.transactions
        .where('[user_id+date]')
        .between(
          [user.id, startDate || Dexie.minKey],
          [user.id, endDate || Dexie.maxKey],
          true,
          true
        )
        .toArray()
    } else {
      items = await db.transactions
        .where('user_id')
        .equals(user.id)
        .toArray()
    }

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (
          value !== undefined &&
          value !== null &&
          value !== ''
        ) {
          items = items.filter(
            (item: any) => item[key] === value
          )
        }
      }
    }

    return items.sort((a, b) => {
      const dateCompare = String(b.date || '').localeCompare(
        String(a.date || '')
      )

      if (dateCompare !== 0) return dateCompare

      return String(b.created_at || '').localeCompare(
        String(a.created_at || '')
      )
    })
  }, [
    user?.id,
    context,
    filtersKey,
    startDate,
    endDate,
  ])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}
