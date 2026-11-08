'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { collectSmartSearchSuggestions } from '@/lib/smartSearchTurbo'
export type { SmartSearchSuggestion } from '@/lib/smartSearchTurbo'


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

    // O índice Dexie já isolou usuário e contexto; agrupamento é puro e testável.
    return collectSmartSearchSuggestions(all, debounced, type)
  }, [user?.id, debounced, context, type])

  return suggestions ?? []
}