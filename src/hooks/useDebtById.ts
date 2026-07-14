'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useDebtById(debtId?: string | null) {
  const { user } = useAuth()

  const debt = useLiveQuery(async () => {
    if (!user?.id || !debtId) return null
    const item = await db.debts.get(debtId)
    // Retorna null se não encontrar ou se não pertencer ao usuário
    return item?.user_id === user.id ? item : null
  }, [user?.id, debtId])

  return {
    debt,
    isLoading: debt === undefined, // true enquanto carrega
  }
}