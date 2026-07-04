// src/lib/db.ts
import Dexie, { Table } from 'dexie'

// ============================================================
// TIPOS DAS TABELAS
// ============================================================
export interface LocalTransaction {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  type: 'income' | 'expense' | 'transfer' | 'sangria'
  amount: number
  description: string
  date: string
  status: 'pending' | 'done'
  affects_balance: boolean
  category_id?: string | null
  account_id?: string | null
  credit_card_id?: string | null
  debt_id?: string | null
  receipt_url?: string | null
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
  sync_attempts: number
  last_sync_error?: string | null
}

export interface LocalAccount {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  name: string
  color: string
  balance: number
  is_archived: boolean
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalCategory {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  name: string
  icon: string
  color: string
  type: 'income' | 'expense'
  is_archived: boolean
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalDebt {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  person_name: string
  description?: string
  total_amount: number
  paid_amount: number
  due_date: string
  status: 'pending' | 'partial' | 'paid' | 'cancelled'
  icon: string
  color: string
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalSyncQueue {
  id: string
  user_id: string
  table: 'transactions' | 'accounts' | 'categories' | 'debts'
  operation: 'create' | 'update' | 'delete'
  record_id: string
  data: any
  created_at: string
  attempts: number
  last_error?: string | null
}

// ============================================================
// BANCO DE DADOS
// ============================================================
class DFLDatabase extends Dexie {
  transactions!: Table<LocalTransaction, string>
  accounts!: Table<LocalAccount, string>
  categories!: Table<LocalCategory, string>
  debts!: Table<LocalDebt, string>
  syncQueue!: Table<LocalSyncQueue, string>

  constructor() {
    super('DFLFinanceDB')

    this.version(1).stores({
      transactions: 'id, user_id, context, date, status, sync_status, account_id, category_id',
      accounts: 'id, user_id, context, sync_status',
      categories: 'id, user_id, context, type, sync_status',
      debts: 'id, user_id, context, status, sync_status',
      syncQueue: 'id, user_id, table, operation, record_id, created_at',
    })
  }
}

export const db = new DFLDatabase()

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

export async function clearAllLocalData() {
  await db.transactions.clear()
  await db.accounts.clear()
  await db.categories.clear()
  await db.debts.clear()
  await db.syncQueue.clear()
}

export async function getPendingSyncItems(userId: string) {
  return db.syncQueue
    .where('user_id')
    .equals(userId)
    .sortBy('created_at')
}

export async function addToSyncQueue(
  userId: string,
  table: LocalSyncQueue['table'],
  operation: LocalSyncQueue['operation'],
  recordId: string,
  data: any
) {
  return db.syncQueue.add({
    id: crypto.randomUUID(),
    user_id: userId,
    table,
    operation,
    record_id: recordId,
    data,
    created_at: new Date().toISOString(),
    attempts: 0,
  })
}

export async function removeFromSyncQueue(id: string) {
  return db.syncQueue.delete(id)
}

export async function markSyncFailed(id: string, error: string) {
  const item = await db.syncQueue.get(id)
  if (item) {
    await db.syncQueue.update(id, {
      attempts: item.attempts + 1,
      last_error: error,
    })
  }
}