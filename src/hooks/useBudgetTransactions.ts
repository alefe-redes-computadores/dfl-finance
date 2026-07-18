'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useBudgetTransactions(budgetId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !budgetId) return []

    const budget = await db.budgets.get(budgetId)
    if (!budget) return []

    // ✅ USA ÍNDICE SIMPLES 'user_id'
    let items = await db.transactions
      .where('user_id')
      .equals(user.id)
      .toArray()

    // ✅ FILTRA POR CATEGORIA EM MEMÓRIA (não usa índice composto)
    if (budget.category_id) {
      items = items.filter((item) => item.category_id === budget.category_id)
    }

    // Apenas despesas concluídas
    items = items.filter(
      (item) =>
        (item.type === 'expense' || item.type === 'sangria') &&
        item.status === 'done'
    )

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