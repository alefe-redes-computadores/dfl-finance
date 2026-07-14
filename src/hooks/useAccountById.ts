'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useAccountById(id?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    // ✅ VERIFICA SE ESTÁ NO CLIENTE E SE O DB EXISTE
    if (typeof window === 'undefined' || !db) return null
    if (!user?.id || !id) return null

    try {
      const found = await db.accounts.get(id)
      if (!found || found.user_id !== user.id) return null
      return found
    } catch (err) {
      console.error('useAccountById error:', err)
      return null
    }
  }, [user?.id, id])

  return {
    data,
    loading: data === undefined,
    notFound: data === null,
  }
}