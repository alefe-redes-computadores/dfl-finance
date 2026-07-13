// src/lib/safeDb.ts

import { db } from './db'
import { addToSyncQueue } from './db'

type TableName = 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications' | 'chat_history' | 'chat_sessions'

interface SafeResult<T = any> {
  success: boolean
  data?: T
  error?: string
  affected?: number
  operation: 'add' | 'update' | 'delete'
  table: string
  id?: string
}

function logOperation(operation: string, table: string, id: string | undefined, result: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] 📝 ${operation} ${table}${id ? ` id:${id}` : ''} => ${result.success ? '✅' : '❌'}`)
  if (!result.success) {
    console.error(`❌ Falha em ${operation} ${table}:`, result.error)
  }
  return result
}

export async function safeAdd<T extends Record<string, any>>(
  table: TableName,
  data: T,
  userId: string
): Promise<SafeResult<T>> {
  try {
    if (data.id) {
      const existing = await db.table(table).get(data.id)
      if (existing) {
        return {
          success: false,
          error: `Já existe um registro com ID ${data.id} em ${table}`,
          operation: 'add',
          table,
          id: data.id
        }
      }
    }

    const id = await db.table(table).add(data)
    await addToSyncQueue(userId, table, 'create', id as string, { ...data, id: id as string })
    
    const result = {
      success: true,
      data: { ...data, id },
      operation: 'add' as const,
      table,
      id: id as string
    }
    
    return logOperation('add', table, id as string, result)
  } catch (error: any) {
    return logOperation('add', table, undefined, {
      success: false,
      error: error.message || 'Erro ao adicionar',
      operation: 'add' as const,
      table
    })
  }
}

export async function safeUpdate(
  table: TableName,
  id: string,
  data: Record<string, any>,
  userId: string
): Promise<SafeResult> {
  try {
    const existing = await db.table(table).get(id)
    if (!existing) {
      return logOperation('update', table, id, {
        success: false,
        error: `Registro não encontrado em ${table} com ID ${id}`,
        operation: 'update' as const,
        table,
        id
      })
    }

    const affected = await db.table(table).update(id, data)
    
    if (affected === 0) {
      return logOperation('update', table, id, {
        success: false,
        error: `Nenhuma linha afetada ao atualizar ${table} com ID ${id}`,
        operation: 'update' as const,
        table,
        id,
        affected: 0
      })
    }

    // 🔥 CORREÇÃO: Enviando o ID dentro do payload para o Supabase reconhecer o registro
    await addToSyncQueue(userId, table, 'update', id, { ...data, id })
    
    const result = {
      success: true,
      operation: 'update' as const,
      table,
      id,
      affected
    }
    
    return logOperation('update', table, id, result)
  } catch (error: any) {
    return logOperation('update', table, id, {
      success: false,
      error: error.message || 'Erro ao atualizar',
      operation: 'update' as const,
      table,
      id
    })
  }
}

export async function safeDelete(
  table: TableName,
  id: string,
  userId: string
): Promise<SafeResult> {
  try {
    const existing = await db.table(table).get(id)
    if (!existing) {
      return logOperation('delete', table, id, {
        success: false,
        error: `Registro não encontrado em ${table} com ID ${id}`,
        operation: 'delete' as const,
        table,
        id
      })
    }

    await db.table(table).delete(id)
    await addToSyncQueue(userId, table, 'delete', id, { id })
    
    const result = {
      success: true,
      operation: 'delete' as const,
      table,
      id
    }
    
    return logOperation('delete', table, id, result)
  } catch (error: any) {
    return logOperation('delete', table, id, {
      success: false,
      error: error.message || 'Erro ao deletar',
      operation: 'delete' as const,
      table,
      id
    })
  }
}
