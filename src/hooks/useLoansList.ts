// src/hooks/useLoansList.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useLoansList(context?: 'dfl' | 'personal', status?: 'active' | 'paid' | 'overdue') {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    let items = await db.loans
      .where('user_id')
      .equals(user.id)
      .toArray()

    if (context) {
      items = items.filter((item) => item.context === context)
    }

    if (status) {
      items = items.filter((item) => item.status === status)
    }

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