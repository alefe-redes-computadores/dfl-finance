import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { safeAdd, safeUpdate, safeDelete } from '@/lib/safeDb'

type TableName = 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications' | 'chat_history' | 'chat_sessions'

export function useSafeDb() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const safeAddWrapper = useCallback(async <T extends Record<string, any>>(
    table: TableName,
    data: T
  ) => {
    if (!user?.id) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    setLoading(true)
    setError(null)

    try {
      const result = await safeAdd(table, data, user.id)
      
      if (!result.success) {
        setError(result.error || 'Erro ao adicionar')
      }
      
      return result
    } catch (err: any) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [user])

  const safeUpdateWrapper = useCallback(async (
    table: TableName,
    id: string,
    data: Record<string, any>
  ) => {
    if (!user?.id) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    setLoading(true)
    setError(null)

    try {
      const result = await safeUpdate(table, id, data, user.id)
      
      if (!result.success) {
        setError(result.error || 'Erro ao atualizar')
      }
      
      return result
    } catch (err: any) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [user])

  const safeDeleteWrapper = useCallback(async (
    table: TableName,
    id: string
  ) => {
    if (!user?.id) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    setLoading(true)
    setError(null)

    try {
      const result = await safeDelete(table, id, user.id)
      
      if (!result.success) {
        setError(result.error || 'Erro ao excluir')
      }
      
      return result
    } catch (err: any) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [user])

  return {
    safeAdd: safeAddWrapper,
    safeUpdate: safeUpdateWrapper,
    safeDelete: safeDeleteWrapper,
    loading,
    error
  }
}
