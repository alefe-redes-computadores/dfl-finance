// src/hooks/useAccountTransactions.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountTransactions(accountId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !accountId) return []

    // ✅ Usa o mesmo padrão do useDebtPayments: busca direta
    const results = await db.transactions
      .where('account_id')
      .equals(accountId)
      .toArray()

    // ✅ Filtra por user_id depois (mesmo padrão do useDebtsList)
    return results.filter(tx => tx.user_id === user.id)
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