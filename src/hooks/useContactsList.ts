// src/hooks/useContactsList.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'

import { db, type LocalContact } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useContactsList(context?: 'dfl' | 'personal') {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    let items = await db.contacts
      .where('user_id')
      .equals(user.id)
      .toArray()

    if (context) {
      items = items.filter((item) => item.context === context)
    }

    return items.sort((a, b) => {
      const updatedCompare = String(b.updated_at || '').localeCompare(
        String(a.updated_at || '')
      )

      if (updatedCompare !== 0) return updatedCompare

      return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR')
    }) as LocalContact[]
  }, [user?.id, context])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}
