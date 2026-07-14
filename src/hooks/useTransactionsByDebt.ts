// src/hooks/useTransactionsByDebt.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useTransactionsByDebt(debtId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !debtId) return []

    // Usa índice composto [user_id+debt_id] se disponível
    return await db.transactions
      .where('[user_id+debt_id]')
      .equals([user.id, debtId])
      .toArray()
  }, [user?.id, debtId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}