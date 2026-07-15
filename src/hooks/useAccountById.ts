'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountById(id?: string | null) {
  const { user, loading: authLoading } = useAuth()

  const data = useLiveQuery(async () => {
    if (authLoading) return undefined
    if (!user?.id || !id) return null

    const found = await db.accounts.get(id)

    if (!found) return null
    if (found.user_id !== user.id) return null

    return found
  }, [authLoading, user?.id, id])

  const loading = authLoading || data === undefined
  const notFound = !loading && data === null

  return {
    data,
    loading,
    notFound,
  }
}