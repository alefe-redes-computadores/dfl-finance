'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useDebtById(debtId?: string | null) {
  const { user } = useAuth()

  const debt = useLiveQuery(async () => {
    if (!user?.id || !debtId) return null

    const item = await db.debts.get(debtId)

    if (!item) return null
    if (item.user_id !== user.id) return null

    return item
  }, [user?.id, debtId], null)

  return {
    debt,
    loading: debt === undefined,
  }
}