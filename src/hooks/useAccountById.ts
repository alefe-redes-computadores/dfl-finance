// src/hooks/useAccountById.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountById(id?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !id) return null

    // ✅ MESMO PADRÃO do useDebtById
    const found = await db.accounts.get(id)

    if (!found) return null
    if (found.user_id !== user.id) return null

    return found
  }, [user?.id, id])

  return {
    data,
    loading: data === undefined,
    notFound: data === null,
  }
}