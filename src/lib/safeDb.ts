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
 *
 * ============================================================
 * 🔥 CORRIGIDO: LÓGICA DE DEPENDÊNCIA INVERTIDA
 *
 * A verificação antiga (checkTransactionDependencies) bloqueava a
 * exclusão de uma transação sempre que a conta/cartão/dívida/
 * financiamento vinculado a ela AINDA EXISTIA — ou seja, bloqueava
 * no caso NORMAL (uma transação sempre aponta pra uma conta que
 * existe). Na prática isso significava que praticamente NENHUMA
 * transação real conseguia ser excluída por essa função, porque
 * quase toda transação tem account_id/credit_card_id preenchido.
 *
 * O motivo de existir uma checagem de dependência é o oposto:
 * normalmente você protege a exclusão de uma ENTIDADE PAI (ex: uma
 * conta) enquanto ela ainda tiver transações filhas — não o
 * contrário. Excluir uma transação nunca "orfaniza" a conta (contas
 * não dependem de transações para existir).
 *
 * Removida a checagem — ela não protegia nada e só quebrava a
 * funcionalidade de exclusão.
 * ============================================================
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
