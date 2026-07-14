// src/lib/hooks/useDebtPayments.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import type { LocalTransaction } from '@/lib/db'

export function useDebtPayments(debtId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !debtId) return []

    const results = await db.transactions
      .where('[user_id+debt_id]')
      .equals([user.id, debtId])
      .toArray()

    return results.sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0
      const bTime = b.date ? new Date(b.date).getTime() : 0
      return bTime - aTime
    })
  }, [user?.id, debtId])

  return {
    data: (data ?? []) as LocalTransaction[],
    loading: data === undefined,
  }
}