// src/hooks/useDebtById.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useDebtById(debtId?: string | null) {
  const { user } = useAuth()

  const debt = useLiveQuery(async () => {
    console.log('[useDebtById] Início da consulta', {
      debtId,
      userId: user?.id ?? null,
    })

    if (!user?.id || !debtId) {
      console.log('[useDebtById] Consulta abortada', {
        debtId,
        userId: user?.id ?? null,
      })
      return null
    }

    const found = await db.debts.get(debtId)

    console.log('[useDebtById] Resultado bruto Dexie', {
      searchedId: debtId,
      foundId: found?.id ?? null,
      foundUserId: found?.user_id ?? null,
      sessionUserId: user.id,
      found,
    })

    if (!found) {
      console.warn('[useDebtById] Registro não encontrado', {
        searchedId: debtId,
      })
      return null
    }

    if (found.user_id !== user.id) {
      console.warn('[useDebtById] user_id divergente', {
        searchedId: debtId,
        foundId: found.id,
        foundUserId: found.user_id,
        sessionUserId: user.id,
      })
      return null
    }

    console.log('[useDebtById] Registro válido encontrado', {
      searchedId: debtId,
      foundId: found.id,
    })

    return found
  }, [user?.id, debtId])

  return {
    debt,
    loading: debt === undefined,
    notFound: debt === null,
  }
}