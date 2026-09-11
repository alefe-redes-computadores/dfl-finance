// src/hooks/useFinancingInstallments.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useFinancingInstallments(
  financingId?: string | null
) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !financingId) return []

    const items = await db.transactions
      .where('[user_id+financing_id]')
      .equals([user.id, financingId])
      .toArray()

    return items
      .filter(
        (item) =>
          item.type === 'financing_installment'
      )
      .sort((a, b) => {
        const aNum =
          a.installment_number || 0
        const bNum =
          b.installment_number || 0

        return aNum - bNum
      })
  }, [user?.id, financingId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}
