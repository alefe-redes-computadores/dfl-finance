// src/lib/safeDb.ts

import { db, addToSyncQueue } from './db'

type TableName =
  | 'transactions'
  | 'accounts'
  | 'categories'
  | 'debts'
  | 'loans'
  | 'financings'
  | 'subscriptions'
  | 'tags'
  | 'contacts'
  | 'budgets'
  | 'goals'
  | 'credit_cards'
  | 'credit_invoices'
  | 'notifications'
  | 'chat_history'
  | 'chat_sessions'

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
    const recordId = data.id ?? crypto.randomUUID()

    const existing = await db.table(table).get(recordId)
    if (existing) {
      return logOperation('add', table, recordId, {
        success: false,
        error: `Já existe um registro com ID ${recordId} em ${table}`,
        operation: 'add' as const,
        table,
        id: recordId,
      })
    }

    if (data.user_id && data.user_id !== userId) {
      return logOperation('add', table, recordId, {
        success: false,
        error: `Usuário não autorizado a criar registro em ${table}`,
        operation: 'add' as const,
        table,
        id: recordId,
      })
    }

    const finalRecord = {
      ...data,
      id: recordId,
      user_id: userId,
      created_at: data.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    }

    await db.transaction('rw', db.table(table), db.syncQueue, async () => {
      await db.table(table).add(finalRecord)
      await addToSyncQueue(userId, table, 'create', recordId, finalRecord)
    })

    return logOperation('add', table, recordId, {
      success: true,
      data: finalRecord,
      operation: 'add' as const,
      table,
      id: recordId,
    })
  } catch (error: any) {
    return logOperation('add', table, undefined, {
      success: false,
      error: error?.message || 'Erro ao adicionar',
      operation: 'add' as const,
      table,
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
        id,
      })
    }

    if (existing.user_id && existing.user_id !== userId) {
      return logOperation('update', table, id, {
        success: false,
        error: `Usuário não autorizado a atualizar registro em ${table}`,
        operation: 'update' as const,
        table,
        id,
      })
    }

    const finalRecord = {
      ...existing,
      ...data,
      id,
      user_id: userId,
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    }

    await db.transaction('rw', db.table(table), db.syncQueue, async () => {
      await db.table(table).put(finalRecord)
      await addToSyncQueue(userId, table, 'update', id, finalRecord)
    })

    return logOperation('update', table, id, {
      success: true,
      data: finalRecord,
      operation: 'update' as const,
      table,
      id,
      affected: 1,
    })
  } catch (error: any) {
    return logOperation('update', table, id, {
      success: false,
      error: error?.message || 'Erro ao atualizar',
      operation: 'update' as const,
      table,
      id,
    })
  }
}

export async function safeReorderCategories(
  firstId: string,
  secondId: string,
  firstOrder: number,
  secondOrder: number,
  userId: string
): Promise<SafeResult> {
  try {
    const [first, second] = await Promise.all([
      db.categories.get(firstId),
      db.categories.get(secondId),
    ])

    if (!first || !second) {
      return logOperation('update', 'categories', firstId, {
        success: false,
        error: 'Não foi possível localizar as categorias para reordenar.',
        operation: 'update' as const,
        table: 'categories',
        id: firstId,
      })
    }

    if (first.user_id !== userId || second.user_id !== userId) {
      return logOperation('update', 'categories', firstId, {
        success: false,
        error: 'Usuário não autorizado a reordenar estas categorias.',
        operation: 'update' as const,
        table: 'categories',
        id: firstId,
      })
    }

    if (first.context !== second.context || first.type !== second.type) {
      return logOperation('update', 'categories', firstId, {
        success: false,
        error: 'Só é possível reordenar categorias do mesmo contexto e tipo.',
        operation: 'update' as const,
        table: 'categories',
        id: firstId,
      })
    }

    const now = new Date().toISOString()

    const firstRecord = {
      ...first,
      order_index: secondOrder,
      updated_at: now,
      sync_status: 'pending',
    }

    const secondRecord = {
      ...second,
      order_index: firstOrder,
      updated_at: now,
      sync_status: 'pending',
    }

    await db.transaction('rw', db.categories, db.syncQueue, async () => {
      await db.categories.put(firstRecord)
      await db.categories.put(secondRecord)

      await addToSyncQueue(
        userId,
        'categories',
        'update',
        firstId,
        firstRecord
      )

      await addToSyncQueue(
        userId,
        'categories',
        'update',
        secondId,
        secondRecord
      )
    })

    return logOperation('update', 'categories', firstId, {
      success: true,
      operation: 'update' as const,
      table: 'categories',
      id: firstId,
      affected: 2,
    })
  } catch (error: any) {
    return logOperation('update', 'categories', firstId, {
      success: false,
      error: error?.message || 'Erro ao reordenar categorias',
      operation: 'update' as const,
      table: 'categories',
      id: firstId,
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
        id,
      })
    }

    if (existing.user_id && existing.user_id !== userId) {
      return logOperation('delete', table, id, {
        success: false,
        error: `Usuário não autorizado a excluir registro em ${table}`,
        operation: 'delete' as const,
        table,
        id,
      })
    }

    if (table === 'categories') {
      if (existing.is_default) {
        return logOperation('delete', table, id, {
          success: false,
          error: 'Categorias padrão não podem ser excluídas.',
          operation: 'delete' as const,
          table,
          id,
        })
      }

      const transactionsCount = await db.transactions
        .where('category_id')
        .equals(id)
        .and((tx: any) => tx.user_id === userId)
        .count()

      if (transactionsCount > 0) {
        return logOperation('delete', table, id, {
          success: false,
          error: 'Esta categoria possui movimentações e não pode ser excluída. Preserve o histórico financeiro.',
          operation: 'delete' as const,
          table,
          id,
        })
      }

      const budgetsCount = await db.budgets
        .where('category_id')
        .equals(id)
        .and((budget: any) => budget.user_id === userId)
        .count()

      if (budgetsCount > 0) {
        return logOperation('delete', table, id, {
          success: false,
          error: 'Esta categoria está vinculada a um orçamento e não pode ser excluída.',
          operation: 'delete' as const,
          table,
          id,
        })
      }
    }

    if (table === 'tags') {
      const linkedTransactions = await db.transactions
        .where('user_id')
        .equals(userId)
        .filter((tx: any) => Array.isArray(tx.tag_ids) && tx.tag_ids.includes(id))
        .toArray()

      const now = new Date().toISOString()

      await db.transaction('rw', db.tags, db.transactions, db.syncQueue, async () => {
        for (const tx of linkedTransactions) {
          const remainingTagIds = (tx.tag_ids as string[]).filter((tagId) => tagId !== id)
          const updatedTransaction = {
            ...tx,
            tag_ids: remainingTagIds.length > 0 ? remainingTagIds : null,
            updated_at: now,
            sync_status: 'pending',
          }

          await db.transactions.put(updatedTransaction)
          await addToSyncQueue(
            userId,
            'transactions',
            'update',
            tx.id,
            updatedTransaction
          )
        }

        await db.tags.delete(id)
        await addToSyncQueue(userId, 'tags', 'delete', id, {
          id,
          user_id: existing.user_id ?? userId,
          deleted_at: now,
        })
      })

      return logOperation('delete', table, id, {
        success: true,
        operation: 'delete' as const,
        table,
        id,
        affected: linkedTransactions.length + 1,
      })
    }

    if (table === 'contacts') {
      const linkedTransactions = await db.transactions
        .where('user_id')
        .equals(userId)
        .filter((tx: any) => tx.contact_id === id)
        .toArray()

      const linkedDebts = await db.debts
        .where('user_id')
        .equals(userId)
        .filter((debt: any) => debt.contact_id === id)
        .toArray()

      const now = new Date().toISOString()

      await db.transaction(
        'rw',
        db.contacts,
        db.transactions,
        db.debts,
        db.syncQueue,
        async () => {
          for (const tx of linkedTransactions) {
            const updatedTransaction = {
              ...tx,
              contact_id: null,
              updated_at: now,
              sync_status: 'pending',
            }

            await db.transactions.put(updatedTransaction)
            await addToSyncQueue(
              userId,
              'transactions',
              'update',
              tx.id,
              updatedTransaction
            )
          }

          for (const debt of linkedDebts) {
            const updatedDebt = {
              ...debt,
              contact_id: null,
              updated_at: now,
              sync_status: 'pending',
            }

            await db.debts.put(updatedDebt)
            await addToSyncQueue(
              userId,
              'debts',
              'update',
              debt.id,
              updatedDebt
            )
          }

          await db.contacts.delete(id)
          await addToSyncQueue(userId, 'contacts', 'delete', id, {
            id,
            user_id: existing.user_id ?? userId,
            deleted_at: now,
          })
        }
      )

      return logOperation('delete', table, id, {
        success: true,
        operation: 'delete' as const,
        table,
        id,
        affected: linkedTransactions.length + linkedDebts.length + 1,
      })
    }

    if (table === 'accounts') {
      const transactionsCount = await db.transactions
        .where('account_id')
        .equals(id)
        .and((tx: any) => tx.user_id === userId)
        .count()

      if (transactionsCount > 0) {
        return logOperation('delete', table, id, {
          success: false,
          error: 'Esta conta possui movimentações e não pode ser excluída. Preserve o histórico financeiro.',
          operation: 'delete' as const,
          table,
          id,
        })
      }
    }

    if (table === 'credit_cards') {
      const transactionsCount = await db.transactions
        .where('credit_card_id')
        .equals(id)
        .and((tx: any) => tx.user_id === userId)
        .count()

      if (transactionsCount > 0) {
        return logOperation('delete', table, id, {
          success: false,
          error: 'Este cartão possui movimentações e não pode ser excluído. Preserve o histórico financeiro.',
          operation: 'delete' as const,
          table,
          id,
        })
      }

      const invoicesCount = await db.credit_invoices
        .where('[user_id+credit_card_id]')
        .equals([userId, id])
        .count()

      if (invoicesCount > 0) {
        return logOperation('delete', table, id, {
          success: false,
          error: 'Este cartão possui faturas e não pode ser excluído. Preserve o histórico financeiro.',
          operation: 'delete' as const,
          table,
          id,
        })
      }
    }

    await db.transaction('rw', db.table(table), db.syncQueue, async () => {
      await db.table(table).delete(id)
      await addToSyncQueue(userId, table, 'delete', id, {
        id,
        user_id: existing.user_id ?? userId,
        deleted_at: new Date().toISOString(),
      })
    })

    return logOperation('delete', table, id, {
      success: true,
      operation: 'delete' as const,
      table,
      id,
    })
  } catch (error: any) {
    return logOperation('delete', table, id, {
      success: false,
      error: error?.message || 'Erro ao deletar',
      operation: 'delete' as const,
      table,
      id,
    })
  }
}
