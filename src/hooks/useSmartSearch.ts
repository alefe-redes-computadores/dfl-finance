'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export interface SmartSearchSuggestion {
  description: string
  category_id: string | null
  account_id: string | null
  credit_card_id: string | null
  amount: number
  type: 'income' | 'expense' | 'transfer' | 'sangria'
  count: number
  last_date: string
}

/**
 * Busca as últimas transações que batem com o texto digitado,
 * respeitando o contexto ativo (dfl/personal) e opcionalmente o tipo.
 * Agrupa por descrição (case-insensitive), mantém a ocorrência mais
 * recente de cada uma e retorna no máximo 5, ordenadas por data desc.
 */
export function useSmartSearch(
  query: string,
  context: 'dfl' | 'personal',
  type?: 'income' | 'expense'
) {
  const { user } = useAuth()
  const [debounced, setDebounced] = useState(query)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220)
    return () => clearTimeout(t)
  }, [query])

  const suggestions = useLiveQuery(async () => {
    if (!user?.id) return []
    const term = debounced.trim().toLowerCase()
    if (term.length < 2) return []

    const all = await db.transactions
      .where('[user_id+context]')
      .equals([user.id, context])
      .toArray()

    const matches = all.filter(
      (t) => t.description?.toLowerCase().includes(term) && (!type || t.type === type)
    )

    const grouped = new Map<string, SmartSearchSuggestion>()

    for (const t of matches) {
      const key = t.description.trim().toLowerCase()
      const existing = grouped.get(key)

      if (!existing) {
        grouped.set(key, {
          description: t.description,
          category_id: (t as any).category_id ?? null,
          account_id: (t as any).account_id ?? null,
          credit_card_id: (t as any).credit_card_id ?? null,
          amount: t.amount,
          type: t.type,
          count: 1,
          last_date: t.date,
        })
      } else {
        existing.count += 1
        if (new Date(t.date) > new Date(existing.last_date)) {
          existing.category_id = (t as any).category_id ?? null
          existing.account_id = (t as any).account_id ?? null
          existing.credit_card_id = (t as any).credit_card_id ?? null
          existing.amount = t.amount
          existing.last_date = t.date
        }
      }
    }

    return Array.from(grouped.values())
      .sort((a, b) => new Date(b.last_date).getTime() - new Date(a.last_date).getTime())
      .slice(0, 5)
  }, [user?.id, debounced, context, type])

  return suggestions ?? []
}