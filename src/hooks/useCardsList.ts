// src/hooks/useCardsList.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useCardsList(context?: 'dfl' | 'personal', includeArchived = false) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    let items = context
      ? await db.credit_cards
          .where('[user_id+context]')
          .equals([user.id, context])
          .toArray()
      : await db.credit_cards
          .where('user_id')
          .equals(user.id)
          .toArray()

    if (!includeArchived) {
      items = items.filter((item) => !item.is_archived)
    }

    return items.sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0
      return bTime - aTime
    })
  }, [user?.id, context, includeArchived])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}