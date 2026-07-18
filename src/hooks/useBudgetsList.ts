// src/hooks/useBudgetsList.ts

'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useBudgetsList(context?: 'dfl' | 'personal', status?: 'active' | 'inactive') {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    // ✅ USA ÍNDICE SIMPLES 'user_id' (QUE EXISTE NO SCHEMA)
    let items = await db.budgets
      .where('user_id')
      .equals(user.id)
      .toArray()

    // ✅ FILTRA POR CONTEXT (em memória, com .filter)
    if (context) {
      items = items.filter((item) => item.context === context)
    }

    // ✅ FILTRA POR STATUS (em memória)
    if (status) {
      items = items.filter((item) => item.status === status)
    }

    // ✅ ORDENA POR updated_at
    return items.sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return bTime - aTime
    })
  }, [user?.id, context, status])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}