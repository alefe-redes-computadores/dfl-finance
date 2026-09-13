// src/hooks/useTagsList.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useTagsList(context?: string) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    if (context) {
      return db.tags
        .where('[user_id+context]')
        .equals([user.id, context])
        .toArray()
    }

    return db.tags
      .where('user_id')
      .equals(user.id)
      .toArray()
  }, [user?.id, context])

  return {
    data: data || [],
    loading: data === undefined,
  }
}
