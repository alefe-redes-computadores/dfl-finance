// src/hooks/useDebtPayments.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, LocalTransaction } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { isDebtPayment } from '@/lib/debtOperations'

export function useDebtPayments(debtId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !debtId) return []

    const results = await db.transactions
      .where('[user_id+debt_id]')
      .equals([user.id, debtId])
      .and(isDebtPayment)
      .toArray()

    return results.sort((a: LocalTransaction, b: LocalTransaction) => {
      const byDate = (b.date || '').localeCompare(a.date || '')
      if (byDate !== 0) return byDate

      return (b.updated_at || '').localeCompare(a.updated_at || '')
    })
  }, [user?.id, debtId])

  return {
    data: (data ?? []) as LocalTransaction[],
    loading: data === undefined,
  }
}
