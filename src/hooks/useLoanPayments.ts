// src/hooks/useLoanPayments.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useLoanPayments(loanId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !loanId) return []

    const transactions = await db.transactions
      .where('user_id')
      .equals(user.id)
      .toArray()

    return transactions
      .filter((item: any) => item.loan_id === loanId && item.type === 'loan_payment')
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [user?.id, loanId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}
