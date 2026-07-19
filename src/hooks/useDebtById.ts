'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useDebtById(debtId?: string | null) {
  const { user } = useAuth()

  const debt = useLiveQuery(async () => {
    // CORREÇÃO: Se ainda não temos os IDs, retornamos "undefined" (e não null).
    // O "undefined" avisa o sistema que ainda estamos "loading",
    // impedindo a tela de fechar por falso positivo de "não encontrado".
    if (!user?.id || !debtId) return undefined

    const found = await db.debts.get(debtId)

    // Se a busca finalizou e realmente não existe, aí sim retornamos null
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
