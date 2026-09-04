// src/hooks/useDebtsList.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db, LocalDebt } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useDebtsList(context?: 'dfl' | 'personal') {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    let results = await db.debts
      .where('user_id')
      .equals(user.id)
      .toArray()

    if (context) {
      results = results.filter((item) => item.context === context)
    }

    return results.sort((a: LocalDebt, b: LocalDebt) => {
      const updatedA = a.updated_at || ''
      const updatedB = b.updated_at || ''
      return updatedB.localeCompare(updatedA)
    })
  }, [user?.id, context])

  return {
    data: (data ?? []) as LocalDebt[],
    loading: data === undefined,
  }
}
