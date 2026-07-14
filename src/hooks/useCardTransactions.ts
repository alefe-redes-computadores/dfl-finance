// src/hooks/useCardTransactions.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useCardTransactions(cardId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !cardId) return []

    // Usa índice composto [user_id+credit_card_id] se disponível
    return await db.transactions
      .where('[user_id+credit_card_id]')
      .equals([user.id, cardId])
      .toArray()
  }, [user?.id, cardId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}