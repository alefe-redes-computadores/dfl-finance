// src/hooks/useAccountTransactions.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountTransactions(accountId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    // ✅ VERIFICAÇÃO DE SEGURANÇA
    if (!user?.id || !accountId) return []
    if (!db || typeof db.transactions === 'undefined') return []

    try {
      return await db.transactions
        .where('account_id')
        .equals(accountId)
        .and(tx => tx.user_id === user.id)
        .toArray()
    } catch (err) {
      console.error('useAccountTransactions error:', err)
      return []
    }
  }, [user?.id, accountId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}