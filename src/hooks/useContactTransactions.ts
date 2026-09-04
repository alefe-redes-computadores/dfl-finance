// src/hooks/useContactTransactions.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'

import { db, type LocalTransaction } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useContactTransactions(contactId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !contactId) return []

    // Não existe índice [user_id+contact_id] no Dexie v5.
    // Filtramos a coleção já isolada pelo usuário para manter o schema atual.
    const items = await db.transactions
      .where('user_id')
      .equals(user.id)
      .filter((tx) => tx.contact_id === contactId)
      .toArray()

    return items.sort((a, b) => {
      const dateCompare = String(b.date || '').localeCompare(String(a.date || ''))
      if (dateCompare !== 0) return dateCompare

      return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    }) as LocalTransaction[]
  }, [user?.id, contactId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}
