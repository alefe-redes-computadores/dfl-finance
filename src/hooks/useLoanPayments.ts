// src/hooks/useLoanPayments.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useLoanPayments(loanId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !loanId) return []

    // Usa índice composto [user_id+loan_id] se disponível
    return await db.transactions
      .where('[user_id+loan_id]')
      .equals([user.id, loanId])
      .toArray()
  }, [user?.id, loanId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}