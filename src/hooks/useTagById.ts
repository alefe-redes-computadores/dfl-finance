// src/hooks/useTagById.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useTagById(id?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !id) return null
    const found = await db.tags.get(id)
    if (!found || found.user_id !== user.id) return null
    return found
  }, [user?.id, id])

  return {
    data,
    loading: data === undefined,
    notFound: data === null,
  }
}