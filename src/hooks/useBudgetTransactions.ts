'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useBudgetTransactions(budgetId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !budgetId) return []

    // ✅ BUSCA O ORÇAMENTO PARA SABER A CATEGORIA
    const budget = await db.budgets.get(budgetId)
    if (!budget) return []

    // ✅ USA ÍNDICE SIMPLES 'user_id' (NÃO USA ÍNDICE COMPOSTO)
    let items = await db.transactions
      .where('user_id')
      .equals(user.id)
      .toArray()

    // ✅ FILTRA POR CATEGORIA EM MEMÓRIA
    if (budget.category_id) {
      items = items.filter((item) => item.category_id === budget.category_id)
    }

    // ✅ APENAS DESPESAS CONCLUÍDAS
    items = items.filter(
      (item) =>
        (item.type === 'expense' || item.type === 'sangria') &&
        item.status === 'done'
    )

    // ✅ ORDENA POR DATA
    return items.sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0
      const bTime = b.date ? new Date(b.date).getTime() : 0
      return bTime - aTime
    })
  }, [user?.id, budgetId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}