// src/lib/hooks/useDebtsList.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import type { LocalDebt } from '@/lib/db'

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

    return results.sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return bTime - aTime
    })
  }, [user?.id, context])

  return {
    data: (data ?? []) as LocalDebt[],
    loading: data === undefined,
  }
}