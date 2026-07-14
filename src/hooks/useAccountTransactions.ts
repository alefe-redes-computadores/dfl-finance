'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountTransactions(accountId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    // ✅ VERIFICA SE ESTÁ NO CLIENTE E SE O DB EXISTE
    if (typeof window === 'undefined' || !db) return []
    if (!user?.id || !accountId) return []

    try {
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