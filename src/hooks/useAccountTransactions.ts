// src/hooks/useAccountTransactions.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountTransactions(
  accountId?: string | null
) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !accountId) return []

    const results = await db.transactions
      .where('[user_id+account_id]')
      .equals([user.id, accountId])
      .toArray()

    return results.sort((a, b) => {
      const dateCompare = String(b.date || '').localeCompare(
        String(a.date || '')
      )

      if (dateCompare !== 0) return dateCompare

      return String(b.created_at || '').localeCompare(
        String(a.created_at || '')
      )
    })
  }, [user?.id, accountId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}
