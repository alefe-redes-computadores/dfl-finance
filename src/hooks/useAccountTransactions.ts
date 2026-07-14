'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountTransactions(accountId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !accountId) return []

    // ✅ Usa o índice account_id diretamente, igual ao useDebtPayments usa [user_id+debt_id]
    const results = await db.transactions
      .where('account_id')
      .equals(accountId)
      .toArray()

    return results
      .filter(tx => tx.user_id === user.id)
      .sort((a, b) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0
        const bTime = b.date ? new Date(b.date).getTime() : 0
        return bTime - aTime
      })
  }, [user?.id, accountId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}