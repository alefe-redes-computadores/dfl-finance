// src/lib/validation.ts

import { db } from './db'

type TableName = 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications' | 'chat_history' | 'chat_sessions'

/**
 * 🔥 VALIDA SE O REGISTRO EXISTE
 */
export async function recordExists(table: TableName, id: string): Promise<boolean> {
  try {
    const record = await db.table(table).get(id)
    return !!record
  } catch (error) {
    console.error(`Erro ao verificar existência em ${table}:`, error)
    return false
  }
}

/**
 * 🔥 VALIDA SE O ID É VÁLIDO (UUID ou string com tamanho mínimo)
 */
export function isValidId(id: string | undefined | null): boolean {
  if (!id) return false
  if (typeof id !== 'string') return false
  if (id.length < 5) return false
  return true
}

/**
 * 🔥 VALIDA SE O REGISTRO TEM DEPENDÊNCIAS
 */
export async function hasDependencies(table: TableName, id: string): Promise<boolean> {
  try {
    if (table === 'transactions') {
      return await checkTransactionDependencies(id)
    }
    if (table === 'accounts') {
      return await checkAccountDependencies(id)
    }
    if (table === 'credit_cards') {
      return await checkCardDependencies(id)
    }
    return false
  } catch (error) {
    console.error(`Erro ao verificar dependências em ${table}:`, error)
    return false
  }
}

async function checkTransactionDependencies(txId: string): Promise<boolean> {
  const tx = await db.table('transactions').get(txId)
  if (!tx) return false

  if (tx.account_id && await recordExists('accounts', tx.account_id)) return true
  if (tx.credit_card_id && await recordExists('credit_cards', tx.credit_card_id)) return true
  if (tx.debt_id && await recordExists('debts', tx.debt_id)) return true
  if (tx.financing_id && await recordExists('financings', tx.financing_id)) return true

  return false
}

async function checkAccountDependencies(accountId: string): Promise<boolean> {
  const txs = await db.table('transactions').where('account_id').equals(accountId).toArray()
  return txs.length > 0
}

async function checkCardDependencies(cardId: string): Promise<boolean> {
  const txs = await db.table('transactions').where('credit_card_id').equals(cardId).toArray()
  const invoices = await db.table('credit_invoices').where('credit_card_id').equals(cardId).toArray()
  return txs.length > 0 || invoices.length > 0
}