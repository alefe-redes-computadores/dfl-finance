// src/hooks/useAccountTransactions.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountTransactions(accountId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !accountId) return []

    // Usa índice composto [user_id+account_id] se disponível
    return await db.transactions
      .where('[user_id+account_id]')
      .equals([user.id, accountId])
      .toArray()
  }, [user?.id, accountId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}