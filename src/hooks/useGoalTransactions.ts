// src/hooks/useGoalTransactions.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LocalTransaction } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useGoalTransactions(
  goalId?: string | null
) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !goalId) {
      return [] as LocalTransaction[]
    }

    return db.transactions
      .where('[user_id+goal_id]')
      .equals([user.id, goalId])
      .toArray()
  }, [user?.id, goalId], [] as LocalTransaction[])

  return {
    data: data ?? [],
    loading: Boolean(
      user?.id &&
      goalId &&
      data === undefined
    ),
  }
}
