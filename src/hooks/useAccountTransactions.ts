'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountTransactions(accountId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !accountId) return []

    // ✅ Usa índice account_id (que existe) e filtra por user_id
    return await db.transactions
      .where('account_id')
      .equals(accountId)
      .and(tx => tx.user_id === user.id)
      .toArray()
  }, [user?.id, accountId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}