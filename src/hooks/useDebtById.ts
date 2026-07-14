'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useDebtById(debtId?: string | null) {
  const { user } = useAuth()

  const debt = useLiveQuery(async () => {
    if (!user?.id || !debtId) return null

    const found = await db.debts.get(debtId)

    if (!found) return null
    if (found.user_id !== user.id) return null

    return found
  }, [user?.id, debtId])

  return {
    debt,
    loading: debt === undefined,
    notFound: debt === null,
  }
}