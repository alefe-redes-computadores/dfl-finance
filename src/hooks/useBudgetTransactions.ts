// src/hooks/useBudgetTransactions.ts

'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useBudgetTransactions(
  budgetId?: string | null
) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !budgetId) {
      return []
    }

    const budget = await db.budgets.get(budgetId)

    if (
      !budget ||
      budget.user_id !== user.id
    ) {
      return []
    }

    let items = await db.transactions
      .where('user_id')
      .equals(user.id)
      .toArray()

    items = items.filter(
      (item) =>
        item.context === budget.context &&
        (
          item.type === 'expense' ||
          item.type === 'sangria'
        ) &&
        item.status === 'done'
    )

    if (budget.category_id) {
      items = items.filter(
        (item) =>
          item.category_id === budget.category_id
      )
    }

    return items.sort((a, b) =>
      String(b.date || '').localeCompare(
        String(a.date || '')
      )
    )
  }, [user?.id, budgetId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}
