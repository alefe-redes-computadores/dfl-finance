'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, LocalTransaction } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useDebtPayments(debtId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !debtId) return []

    // ✅ USA ÍNDICE SIMPLES 'user_id' + FILTRO EM MEMÓRIA
    let results = await db.transactions
      .where('user_id')
      .equals(user.id)
      .toArray()

    // ✅ FILTRA POR debt_id EM MEMÓRIA
    results = results.filter((tx) => tx.debt_id === debtId)

    return results.sort((a: LocalTransaction, b: LocalTransaction) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0
      const bTime = b.date ? new Date(b.date).getTime() : 0
      return bTime - aTime
    })
  }, [user?.id, debtId])

  return {
    data: (data ?? []) as LocalTransaction[],
    loading: data === undefined,
  }
}