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

// ============================================================
// NOVAS TABELAS
// ============================================================
export interface LocalLoan {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  description?: string
  amount: number
  remaining_amount: number
  due_date?: string
  status: 'active' | 'paid' | 'overdue'
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalFinancing {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  name: string
  description?: string
  total_amount: number
  current_installment: number
  total_installments: number
  installment_value: number
  next_due_date?: string
  status: 'active' | 'paid' | 'overdue'
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalSubscription {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  name: string
  amount: number
  billing_cycle: string
  due_day: number
  status: 'active' | 'paused' | 'cancelled'
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalTag {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  name: string
  color: string
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalContact {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  name: string
  type: 'individual' | 'company'
  email?: string
  phone?: string
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalBudget {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  name: string
  amount: number
  spent: number
  remaining: number
  percent: number
  category_id?: string
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalGoal {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  name: string
  target_amount: number
  saved_amount: number
  deadline?: string
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalCreditCard {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  name: string
  brand?: string
  limit_amount: number
  due_day: number
  closing_day: number
  is_archived: boolean
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalCreditInvoice {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  credit_card_id: string
  amount: number
  due_date: string
  closing_date: string
  status: 'open' | 'paid' | 'overdue'
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalNotification {
  id: string
  user_id: string
  type: string
  title: string
  subtitle?: string
  severity: 'info' | 'warning' | 'critical' | 'success'
  read: boolean
  data?: any
  created_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalSyncQueue {
  id: string
  user_id: string
  table: 'transactions' | 'accounts' | 'categories' | 'debts' | 'loans' | 'financings' | 'subscriptions' | 'tags' | 'contacts' | 'budgets' | 'goals' | 'credit_cards' | 'credit_invoices' | 'notifications'
  operation: 'create' | 'update' | 'delete'
  record_id: string
  data: any
  created_at: string
  attempts: number
  last_error?: string | null
}

// ============================================================
// BANCO DE DADOS ATUALIZADO
// ============================================================
class DFLDatabase extends Dexie {
  transactions!: Table<LocalTransaction, string>
  accounts!: Table<LocalAccount, string>
  categories!: Table<LocalCategory, string>
  debts!: Table<LocalDebt, string>
  loans!: Table<LocalLoan, string>
  financings!: Table<LocalFinancing, string>
  subscriptions!: Table<LocalSubscription, string>
  tags!: Table<LocalTag, string>
  contacts!: Table<LocalContact, string>
  budgets!: Table<LocalBudget, string>
  goals!: Table<LocalGoal, string>
  credit_cards!: Table<LocalCreditCard, string>
  credit_invoices!: Table<LocalCreditInvoice, string>
  notifications!: Table<LocalNotification, string>
  syncQueue!: Table<LocalSyncQueue, string>

  constructor() {
    super('DFLFinanceDB')

    this.version(2).stores({
      transactions: 'id, user_id, context, date, status, sync_status, account_id, category_id',
      accounts: 'id, user_id, context, sync_status',
      categories: 'id, user_id, context, type, sync_status',
      debts: 'id, user_id, context, status, sync_status',
      loans: 'id, user_id, context, status, sync_status',
      financings: 'id, user_id, context, status, sync_status',
      subscriptions: 'id, user_id, context, status, sync_status',
      tags: 'id, user_id, context, sync_status',
      contacts: 'id, user_id, context, type, sync_status',
      budgets: 'id, user_id, context, sync_status',
      goals: 'id, user_id, context, status, sync_status',
      credit_cards: 'id, user_id, context, is_archived, sync_status',
      credit_invoices: 'id, user_id, credit_card_id, status, sync_status',
      notifications: 'id, user_id, read, sync_status',
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
  await db.loans.clear()
  await db.financings.clear()
  await db.subscriptions.clear()
  await db.tags.clear()
  await db.contacts.clear()
  await db.budgets.clear()
  await db.goals.clear()
  await db.credit_cards.clear()
  await db.credit_invoices.clear()
  await db.notifications.clear()
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