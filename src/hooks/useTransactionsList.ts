// src/hooks/useTransactionsList.ts
'use client'

import Dexie from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  localFilterSignature,
  stableLocalRows
} from '@/lib/localQueryPolicy'
import {
  invalidTransactionDateRange,
  transactionStableIdCompare
} from '@/lib/transactionListPolicy'

export function useTransactionsList(
  context?: 'dfl' | 'personal',
  filters?: Record<string, any>,
  startDate?: string | null,
  endDate?: string | null
) {
  const { user } = useAuth()
  const filtersKey = localFilterSignature(filters)

  const data = useLiveQuery(async () => {
    if (!user?.id) return []

    // Intervalo invertido nao consulta o IndexedDB.
    if (invalidTransactionDateRange(startDate, endDate)) return []

    let items

    if (context && (startDate || endDate)) {
      items = await db.transactions
        .where('[user_id+context+date]')
        .between(
          [
            user.id,
            context,
            startDate || Dexie.minKey,
          ],
          [
            user.id,
            context,
            endDate || Dexie.maxKey,
          ],
          true,
          true
        )
        .toArray()
    } else if (context) {
      items = await db.transactions
        .where('[user_id+context]')
        .equals([user.id, context])
        .toArray()
    } else if (startDate || endDate) {
      items = await db.transactions
        .where('[user_id+date]')
        .between(
          [user.id, startDate || Dexie.minKey],
          [user.id, endDate || Dexie.maxKey],
          true,
          true
        )
        .toArray()
    } else {
      items = await db.transactions
        .where('user_id')
        .equals(user.id)
        .toArray()
    }

    const activeFilters = Object.entries(filters || {}).filter(
      ([key, value]) =>
        key !== 'user_id' &&
        value !== undefined &&
        value !== null &&
        value !== ''
    )

    if (activeFilters.length) {
      items = items.filter((item: any) =>
        activeFilters.every(
          ([key, value]) => item[key] === value
        )
      )
    }

    return items.sort((a, b) => {
      const dateCompare = String(b.date || '').localeCompare(
        String(a.date || '')
      )

      if (dateCompare !== 0) return dateCompare

      const createdCompare = String(b.created_at || '').localeCompare(
        String(a.created_at || '')
      )

      if (createdCompare !== 0) return createdCompare

      // Desempate deterministico para datas e horarios identicos.
      return transactionStableIdCompare(a, b)
    })
  }, [
    user?.id,
    context,
    filtersKey,
    startDate,
    endDate,
  ])

  return {
    data: stableLocalRows(data),
    loading: data === undefined,
  }
}
