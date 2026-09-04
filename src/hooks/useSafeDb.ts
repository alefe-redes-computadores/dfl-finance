// src/hooks/useSafeDb.ts
'use client'

import { useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { safeAdd, safeUpdate, safeDelete, safeReorderCategories } from '@/lib/safeDb'

type TableName = 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications' | 'chat_history' | 'chat_sessions'

export function useSafeDb() {
  const { user } = useAuth()
  const safeAddWrapper = useCallback(async <T extends Record<string, any>>(
    table: TableName,
    data: T
  ) => {
    if (!user?.id) {
      return { success: false, error: 'Usuário não autenticado' }
    }
    try {
      const result = await safeAdd(table, data, user.id)
      
      if (!result.success) {
      }
      
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
}, [user?.id])

  const safeUpdateWrapper = useCallback(async (
    table: TableName,
    id: string,
    data: Record<string, any>
  ) => {
    if (!user?.id) {
      return { success: false, error: 'Usuário não autenticado' }
    }
    try {
      const result = await safeUpdate(table, id, data, user.id)
      
      if (!result.success) {
      }
      
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
}, [user?.id])

  const safeReorderCategoriesWrapper = useCallback(async (
    firstId: string,
    secondId: string,
    firstOrder: number,
    secondOrder: number
  ) => {
    if (!user?.id) {
      return {
        success: false,
        error: 'Usuário não autenticado'
      }
    }
    try {
      const result = await safeReorderCategories(
        firstId,
        secondId,
        firstOrder,
        secondOrder,
        user.id
      )

      if (!result.success) {
      }

      return result
    } catch (err: any) {
      return {
        success: false,
        error: err.message
      }
    }
}, [user?.id])

  const safeDeleteWrapper = useCallback(async (
    table: TableName,
    id: string
  ) => {
    if (!user?.id) {
      return { success: false, error: 'Usuário não autenticado' }
    }
    try {
      const result = await safeDelete(table, id, user.id)
      
      if (!result.success) {
      }
      
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
}, [user?.id])

  return {
    safeAdd: safeAddWrapper,
    safeUpdate: safeUpdateWrapper,
    safeDelete: safeDeleteWrapper,
    safeReorderCategories: safeReorderCategoriesWrapper,
    error
  }
}
