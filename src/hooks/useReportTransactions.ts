// src/hooks/useReportTransactions.ts
'use client'

import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import { useAuth } from '@/lib/hooks/useAuth'
import { useTransactionsList } from '@/hooks/useTransactionsList'

interface UseReportTransactionsOptions {
  context?: string | null
  startDate?: string | null
  endDate?: string | null
  tags?: string[]
  accounts?: string[]
  creditCards?: string[]
}

function normalizeContext(context?: string | null): 'dfl' | 'personal' | undefined {
  if (context === 'dfl' || context === 'personal') return context
  return undefined
}

function hasArrayOverlap(value: unknown, selected: string[]) {
  if (selected.length === 0) return true
  if (!Array.isArray(value)) return false
  return value.some((item) => selected.includes(String(item)))
}

export function useReportTransactions({
  context,
  startDate,
  endDate,
  tags = [],
  accounts = [],
  creditCards = [],
}: UseReportTransactionsOptions) {
  const { user } = useAuth()
  const transactionContext = normalizeContext(context)

  const { data: rawTransactions, loading: transactionsLoading } =
    useTransactionsList(transactionContext, undefined, startDate || null, endDate || null)

  const categories = useLiveQuery(async () => {
    if (!user?.id) return []
    return db.categories.where('user_id').equals(user.id).toArray()
  }, [user?.id])

  const data = useMemo(() => {
    if (!user?.id || !startDate || !endDate) return []

    const categoryById = new Map(
      (categories || []).map((category: any) => [category.id, category])
    )

    return (rawTransactions || [])
      .filter((transaction: any) => {
        if (transaction.status !== 'done') return false

        if (accounts.length > 0 && !accounts.includes(String(transaction.account_id || ''))) {
          return false
        }

        if (creditCards.length > 0 && !creditCards.includes(String(transaction.credit_card_id || ''))) {
          return false
        }

        if (!hasArrayOverlap(transaction.tag_ids, tags)) return false
        return true
      })
      .map((transaction: any) => {
        const category: any = categoryById.get(transaction.category_id)
        return {
          ...transaction,
          categoryLabel:
            transaction.category ||
            transaction.categories?.name ||
            category?.name ||
            'Geral',
        }
      })
  }, [user?.id, rawTransactions, categories, startDate, endDate, tags, accounts, creditCards])

  return {
    data,
    loading: transactionsLoading || categories === undefined,
  }
}
