// src/hooks/useFinancingInstallments.ts
'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'

export function useFinancingInstallments(financingId?: string | null) {
  const { user } = useAuth()

  const data = useLiveQuery(async () => {
    if (!user?.id || !financingId) return []

    // Busca todas as transações do tipo 'financing_installment' vinculadas ao financiamento
    let items = await db.transactions
      .where('user_id')
      .equals(user.id)
      .toArray()

    return items
      .filter((item) => item.financing_id === financingId && item.type === 'financing_installment')
      .sort((a, b) => {
        // Ordena por número da parcela (assumindo que existe campo 'installment_number')
        const aNum = a.installment_number || 0
        const bNum = b.installment_number || 0
        return aNum - bNum
      })
  }, [user?.id, financingId])

  return {
    data: data ?? [],
    loading: data === undefined,
  }
}