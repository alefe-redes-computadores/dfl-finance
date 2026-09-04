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
  affects_balance?: boolean
  category_id?: string | null
  account_id?: string | null
  credit_card_id?: string | null
  tag_ids?: string[] | null
  contact_id?: string | null
  notes?: string | null
  recurring_group_id?: string | null
  installment_index?: number
  total_installments?: number
  financing_id?: string | null
  is_reimbursable?: boolean
  linked_transaction_id?: string | null
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
  description?: string | null
  total_amount: number
  paid_amount: number
  due_date?: string | null
  status: 'pending' | 'partial' | 'paid' | 'cancelled'
  category_id?: string | null
  account_id?: string | null
  icon: string
  color: string
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
  sync_attempts?: number
}

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
  category_id?: string | null
  name: string
  amount: number
  color?: string | null
  icon?: string | null
  period: 'monthly' | 'biweekly' | 'weekly'
  accumulate?: boolean | null
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
  sync_attempts?: number
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

  // `brand` é mantido por compatibilidade com cartões antigos.
  brand?: string | null
  flag?: string | null
  institution?: string | null
  last_four?: string | null
  payment_account_id?: string | null
  color?: string | null

  limit_amount: number
  due_day: number
  closing_day: number
  is_archived: boolean

  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
  sync_attempts?: number
}

export interface LocalCreditInvoice {
  id: string
  user_id: string
  context: 'dfl' | 'personal'
  credit_card_id: string

  start_date: string
  end_date: string
  closing_date: string
  due_date: string

  total_amount: number
  paid_amount: number

  status: 'open' | 'paid' | 'overdue'
  notes?: string | null
  paid_at?: string | null

  created_at: string
  updated_at: string

  sync_status: 'synced' | 'pending' | 'failed'
  sync_attempts?: number
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

export interface LocalChatMessage {
  id: string
  user_id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  type?: string
  created_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalChatSession {
  id: string
  user_id: string
  title: string
  status: 'active' | 'archived'
  created_at: string
  updated_at: string
  sync_status: 'synced' | 'pending' | 'failed'
}

export interface LocalSyncQueue {
  id: string
  user_id: string
  table:
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
  operation: 'create' | 'update' | 'delete'
  record_id: string
  data: any
  created_at: string
  attempts: number
  revision?: number
  last_error?: string | null
}

// ============================================================
// BANCO DE DADOS ATUALIZADO (v5)
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
  chat_history!: Table<LocalChatMessage, string>
  chat_sessions!: Table<LocalChatSession, string>
  syncQueue!: Table<LocalSyncQueue, string>

  constructor() {
    super('DFLFinanceDB')

    this.version(5).stores({
      transactions:
        'id, user_id, context, date, status, sync_status, account_id, category_id, debt_id, credit_card_id, created_at, updated_at, [user_id+debt_id], [user_id+context], [user_id+date], [user_id+status], [user_id+account_id], [user_id+credit_card_id]',
      accounts:
        'id, user_id, context, sync_status, is_archived, created_at, updated_at, [user_id+context]',
      categories:
        'id, user_id, context, type, sync_status, is_archived, created_at, updated_at, [user_id+context], [user_id+type]',
      debts:
        'id, user_id, context, status, sync_status, due_date, created_at, updated_at, [user_id+context], [user_id+status], [user_id+updated_at], [user_id+due_date]',
      loans:
        'id, user_id, context, status, sync_status, due_date, created_at, updated_at, [user_id+context], [user_id+status]',
      financings:
        'id, user_id, context, status, sync_status, next_due_date, created_at, updated_at, [user_id+context], [user_id+status]',
      subscriptions:
        'id, user_id, context, status, sync_status, due_day, created_at, updated_at, [user_id+context], [user_id+status]',
      tags:
        'id, user_id, context, sync_status, created_at, updated_at, [user_id+context]',
      contacts:
        'id, user_id, context, type, sync_status, created_at, updated_at, [user_id+context], [user_id+type]',
      budgets:
        'id, user_id, context, sync_status, category_id, created_at, updated_at, [user_id+context]',
      goals:
        'id, user_id, context, status, sync_status, deadline, created_at, updated_at, [user_id+context], [user_id+status]',
      credit_cards:
        'id, user_id, context, is_archived, sync_status, created_at, updated_at, [user_id+context]',
      credit_invoices:
        'id, user_id, context, credit_card_id, status, sync_status, due_date, closing_date, created_at, updated_at, [user_id+credit_card_id], [user_id+status]',
      notifications:
        'id, user_id, read, sync_status, created_at, [user_id+read]',
      chat_history:
        'id, user_id, session_id, created_at, sync_status, [user_id+session_id]',
      chat_sessions:
        'id, user_id, status, sync_status, created_at, updated_at, [user_id+status]',
      syncQueue:
        'id, user_id, table, operation, record_id, created_at, [user_id+table], [user_id+created_at]',
    })
  }
}

export const db = new DFLDatabase()

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
export async function clearAllLocalData() {
  await db.transaction(
    'rw',
    db.transactions,
    db.accounts,
    db.categories,
    db.debts,
    db.loans,
    db.financings,
    db.subscriptions,
    db.tags,
    db.contacts,
    db.budgets,
    db.goals,
    db.credit_cards,
    db.credit_invoices,
    db.notifications,
    db.chat_history,
    db.chat_sessions,
    db.syncQueue,
    async () => {
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
      await db.chat_history.clear()
      await db.chat_sessions.clear()
      await db.syncQueue.clear()
    }
  )
}

export async function getPendingSyncItems(userId: string) {
  return db.syncQueue
    .where('user_id')
    .equals(userId)
    .sortBy('created_at')
}

function isQueuePayloadObject(value: any): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function mergeQueuePayload(previous: any, incoming: any) {
  if (isQueuePayloadObject(previous) && isQueuePayloadObject(incoming)) {
    return { ...previous, ...incoming }
  }

  return incoming ?? previous
}

function coalesceQueueOperation(
  previous: LocalSyncQueue['operation'],
  incoming: LocalSyncQueue['operation']
): LocalSyncQueue['operation'] {
  if (incoming === 'delete') return 'delete'
  if (previous === 'delete') return incoming
  if (previous === 'create') return 'create'
  if (incoming === 'create') return 'create'
  return 'update'
}

function coalesceQueueData(
  previousOperation: LocalSyncQueue['operation'],
  previousData: any,
  incomingOperation: LocalSyncQueue['operation'],
  incomingData: any
) {
  if (incomingOperation === 'delete') {
    return incomingData
  }

  if (previousOperation === 'delete') {
    return incomingData
  }

  return mergeQueuePayload(previousData, incomingData)
}

export async function addToSyncQueue(
  userId: string,
  table: LocalSyncQueue['table'],
  operation: LocalSyncQueue['operation'],
  recordId: string,
  data: any
) {
  return db.transaction('rw', db.syncQueue, async () => {
    const existingItems = await db.syncQueue
      .where('[user_id+table]')
      .equals([userId, table])
      .filter((item) => item.record_id === recordId)
      .sortBy('created_at')

    if (existingItems.length === 0) {
      const id = crypto.randomUUID()

      await db.syncQueue.add({
        id,
        user_id: userId,
        table,
        operation,
        record_id: recordId,
        data,
        created_at: new Date().toISOString(),
        attempts: 0,
        revision: 0,
      })

      return id
    }

    const target = existingItems[0]
    let mergedOperation = target.operation
    let mergedData = target.data

    for (const item of existingItems.slice(1)) {
      mergedData = coalesceQueueData(
        mergedOperation,
        mergedData,
        item.operation,
        item.data
      )
      mergedOperation = coalesceQueueOperation(
        mergedOperation,
        item.operation
      )
    }

    mergedData = coalesceQueueData(
      mergedOperation,
      mergedData,
      operation,
      data
    )
    mergedOperation = coalesceQueueOperation(
      mergedOperation,
      operation
    )

    const nextRevision = (target.revision ?? 0) + 1

    await db.syncQueue.update(target.id, {
      operation: mergedOperation,
      data: mergedData,
      attempts: 0,
      last_error: null,
      revision: nextRevision,
    })

    const duplicateIds = existingItems
      .slice(1)
      .map((item) => item.id)

    if (duplicateIds.length > 0) {
      await db.syncQueue.bulkDelete(duplicateIds)
    }

    return target.id
  })
}

export async function removeFromSyncQueue(id: string) {
  return db.syncQueue.delete(id)
}

export async function removeFromSyncQueueIfCurrent(
  id: string,
  expectedRevision: number
) {
  return db.transaction('rw', db.syncQueue, async () => {
    const current = await db.syncQueue.get(id)

    if (!current) {
      return false
    }

    if ((current.revision ?? 0) !== expectedRevision) {
      return false
    }

    await db.syncQueue.delete(id)
    return true
  })
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

export async function markSyncFailedIfCurrent(
  id: string,
  expectedRevision: number,
  error: string
) {
  return db.transaction('rw', db.syncQueue, async () => {
    const current = await db.syncQueue.get(id)

    if (!current) {
      return false
    }

    if ((current.revision ?? 0) !== expectedRevision) {
      return false
    }

    await db.syncQueue.update(id, {
      attempts: (current.attempts || 0) + 1,
      last_error: error,
    })

    return true
  })
}
