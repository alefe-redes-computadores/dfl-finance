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

/**
 * 🔥 LOG DE OPERAÇÕES
 */
function logOperation(operation: string, table: string, id: string | undefined, result: any) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] 📝 ${operation} ${table}${id ? ` id:${id}` : ''} => ${result.success ? '✅' : '❌'}`)
  
  if (!result.success) {
    console.error(`❌ Falha em ${operation} ${table}:`, result.error)
  }
  
  return result
}

/**
 * 🔥 CAMADA 1: ADD SEGURO
 * Verifica se o ID existe antes de adicionar
 */
export async function safeAdd<T extends Record<string, any>>(
  table: TableName,
  data: T,
  userId: string
): Promise<SafeResult<T>> {
  try {
    // Verifica se já existe um registro com esse ID
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

    // Adiciona ao IndexedDB
    const id = await db.table(table).add(data)
    
    // Enfileira para sincronização
    await addToSyncQueue(userId, table, 'create', id as string, data)
    
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

/**
 * 🔥 CAMADA 2: UPDATE SEGURO
 * Verifica se o registro existe antes de atualizar
 */
export async function safeUpdate(
  table: TableName,
  id: string,
  data: Record<string, any>,
  userId: string
): Promise<SafeResult> {
  try {
    // 🔥 VALIDAÇÃO: Verifica se o registro existe
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

    // Atualiza no IndexedDB
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

    // Enfileira para sincronização
    await addToSyncQueue(userId, table, 'update', id, data)
    
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

/**
 * 🔥 CAMADA 3: DELETE SEGURO
 * Verifica se o registro existe antes de deletar
 * Também verifica se há referências em outras tabelas
 */
export async function safeDelete(
  table: TableName,
  id: string,
  userId: string
): Promise<SafeResult> {
  try {
    // 🔥 VALIDAÇÃO: Verifica se o registro existe
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

    // 🔥 VALIDAÇÃO: Verifica referências (se for transação)
    if (table === 'transactions') {
      const hasDependencies = await checkTransactionDependencies(id)
      if (hasDependencies) {
        return logOperation('delete', table, id, {
          success: false,
          error: 'Esta transação está vinculada a uma conta, cartão, dívida ou financiamento. Exclua os vínculos primeiro.',
          operation: 'delete' as const,
          table,
          id
        })
      }
    }

    // Deleta do IndexedDB
    await db.table(table).delete(id)
    
    // Enfileira para sincronização
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

/**
 * 🔥 VERIFICA DEPENDÊNCIAS DA TRANSAÇÃO
 */
async function checkTransactionDependencies(txId: string): Promise<boolean> {
  try {
    // Verifica se está vinculada a uma conta
    const tx = await db.table('transactions').get(txId)
    if (!tx) return false

    // Se tem account_id, verifica se a conta ainda existe
    if (tx.account_id) {
      const account = await db.table('accounts').get(tx.account_id)
      if (account) {
        console.warn(`⚠️ Transação ${txId} está vinculada à conta ${tx.account_id}`)
        return true
      }
    }

    // Se tem credit_card_id, verifica se o cartão ainda existe
    if (tx.credit_card_id) {
      const card = await db.table('credit_cards').get(tx.credit_card_id)
      if (card) {
        console.warn(`⚠️ Transação ${txId} está vinculada ao cartão ${tx.credit_card_id}`)
        return true
      }
    }

    // Se tem debt_id, verifica se a dívida ainda existe
    if (tx.debt_id) {
      const debt = await db.table('debts').get(tx.debt_id)
      if (debt) {
        console.warn(`⚠️ Transação ${txId} está vinculada à dívida ${tx.debt_id}`)
        return true
      }
    }

    // Se tem financing_id, verifica se o financiamento ainda existe
    if (tx.financing_id) {
      const financing = await db.table('financings').get(tx.financing_id)
      if (financing) {
        console.warn(`⚠️ Transação ${txId} está vinculada ao financiamento ${tx.financing_id}`)
        return true
      }
    }

    return false
  } catch (error) {
    console.error('Erro ao verificar dependências:', error)
    return false
  }
}