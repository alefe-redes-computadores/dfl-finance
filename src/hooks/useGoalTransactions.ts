// src/hooks/useGoalTransactions.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useGoalTransactions(goalId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !goalId) return []

    // Usa índice composto [user_id+goal_id] se disponível
    return await db.transactions
      .where('[user_id+goal_id]')
      .equals([user.id, goalId])
      .toArray()
  }, [user?.id, goalId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}