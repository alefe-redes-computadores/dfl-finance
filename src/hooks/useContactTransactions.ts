// src/hooks/useContactTransactions.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useContactTransactions(contactId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !contactId) return []

    // Usa índice composto [user_id+contact_id] se disponível
    return await db.transactions
      .where('[user_id+contact_id]')
      .equals([user.id, contactId])
      .toArray()
  }, [user?.id, contactId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}