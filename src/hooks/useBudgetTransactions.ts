// src/hooks/useBudgetTransactions.ts
'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useBudgetTransactions(budgetId?: string | null) {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    if (!user?.id || !budgetId) return []

    const budget = await db.budgets.get(budgetId)
    if (!budget) return []

    let items = await db.transactions
      .where('user_id')
      .equals(user.id)
      .toArray()

    // Filtra por categoria do orçamento
    if (budget.category_id) {
      items = items.filter((item) => item.category_id === budget.category_id)
    }

    // Apenas despesas concluídas
    items = items.filter((item) => 
      (item.type === 'expense' || item.type === 'sangria') && 
      item.status === 'done'
    )

    // Filtra por período
    if (startDate) {
      items = items.filter((item) => item.date >= startDate)
    }
    if (endDate) {
      items = items.filter((item) => item.date <= endDate)
    }

    return items.sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0
      const bTime = b.date ? new Date(b.date).getTime() : 0
      return bTime - aTime
    })
  }, [user?.id, budgetId, startDate, endDate])

  return {
    data: data ?? [],
    loading: data === undefined,
    setStartDate,
    setEndDate,
  }
}