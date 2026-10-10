import { db, getPendingSyncItems, markSyncFailedIfCurrent, type LocalSyncQueue } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { batchIdentity, expectedSyncBase, remoteSyncBase, type FinancialBatchItem } from '@/lib/financialSyncContract'
import { sanitizeRemotePayload } from '@/lib/remoteSyncPayload'

export const ATOMIC_SYNC_TABLES = [
  'categories', 'accounts', 'contacts', 'credit_cards', 'debts', 'loans', 'financings',
  'subscriptions', 'tags', 'budgets', 'goals', 'chat_sessions', 'credit_invoices',
  'transactions', 'notifications', 'chat_history',
] as const

export type FinancialOutbox = {
  user_id: string
  id: string
  items: FinancialBatchItem[]
  queue: LocalSyncQueue[]
  created_at: string
}

async function prepareOutbox(userId: string): Promise<FinancialOutbox | null> {
  return db.transaction('rw', [db.syncQueue, db.financialOutbox,
    ...ATOMIC_SYNC_TABLES.map(name => db.table(name))], async () => {
    const previous = await db.financialOutbox.get(userId)
    if (previous) return previous
    const queue = await getPendingSyncItems(userId)
    if (!queue.length) return null
    queue.sort((a, b) => {
      const order = ATOMIC_SYNC_TABLES.indexOf(a.table) - ATOMIC_SYNC_TABLES.indexOf(b.table)
      return order || a.record_id.localeCompare(b.record_id)
    })
    const items: FinancialBatchItem[] = []
    for (const item of queue) {
      const row = item.operation === 'delete' ? item.data : await db.table(item.table).get(item.record_id)
      if (!row || row.user_id !== userId) throw new Error('Registro da fila ausente ou sem proprietário válido.')
      const base = expectedSyncBase(row, item.operation)
      if (!base) throw new Error('DFL_LEGACY_REVIEW: há uma alteração antiga sem versão-base. A fila foi preservada para revisão.')
      if (item.table === 'accounts' && item.operation === 'update' && !Number.isFinite(base.balance)) {
        throw new Error('DFL_LEGACY_REVIEW: saldo antigo sem base verificável. A operação foi preservada.')
      }
      items.push({ table: item.table, operation: item.operation, record_id: item.record_id,
        expected_updated_at: base.updated_at,
        ...(item.table === 'accounts' && base.updated_at ? {
          base_balance: base.balance, base_metadata: base.metadata,
        } : {}),
        data: item.operation === 'delete' ? null : sanitizeRemotePayload(row, item.record_id, userId, item.table),
      })
    }
    const envelope = { user_id: userId, id: batchIdentity(items), items, queue, created_at: new Date().toISOString() }
    await db.financialOutbox.add(envelope)
    return envelope
  })
}

/** Acknowledgement and revision rebasing commit together, after remote commit. */
export async function acknowledgeOutbox(envelope: FinancialOutbox, versions: Record<string, string | null>, accounts: Record<string, any> = {}) {
  await db.transaction('rw', [db.syncQueue, db.financialOutbox,
    ...ATOMIC_SYNC_TABLES.map(name => db.table(name))], async () => {
    const stored = await db.financialOutbox.get(envelope.user_id)
    if (stored?.id !== envelope.id) throw new Error('O lote local mudou antes da confirmação.')
    for (let i = 0; i < envelope.queue.length; i++) {
      const sent = envelope.queue[i]
      const versionKey = `${sent.table}/${sent.record_id}`
      if (!(versionKey in versions)) throw new Error('Confirmação remota incompleta. O lote foi preservado.')
      const committedAccount = sent.table === 'accounts' ? accounts[sent.record_id] : null
      if (sent.table === 'accounts' && sent.operation !== 'delete' && !committedAccount) {
        throw new Error('Confirmação remota sem o saldo aplicado. O lote foi preservado.')
      }
      const base = committedAccount ? remoteSyncBase(committedAccount) : { updated_at: versions[versionKey] }
      const current = await db.syncQueue.get(sent.id)
      if (!current) continue
      const row = await db.table(sent.table).get(sent.record_id)
      const sameRevision = (current.revision ?? 0) === (sent.revision ?? 0)
      if (row && row.user_id === envelope.user_id) {
        await db.table(sent.table).update(row.id, {
          ...(committedAccount ? { ...committedAccount, ...row } : {}),
          _sync_base: base,
          ...(committedAccount && sent.operation !== 'delete' ? {
            balance: (Math.round(Number(row.balance) * 100) + Math.round(Number(committedAccount.balance) * 100) -
              Math.round(Number(envelope.items[i].data?.balance) * 100)) / 100,
          } : {}),
          ...(sameRevision ? { sync_status: 'synced', sync_attempts: 0, last_sync_error: null,
            ...(base.updated_at ? { updated_at: base.updated_at } : {}) } : {}),
        })
      }
      if (sameRevision) {
        await db.syncQueue.delete(current.id)
      } else {
        await db.syncQueue.update(current.id, {
          operation: current.operation === 'delete' ? 'delete' : base.updated_at ? 'update' : 'create',
          data: { ...current.data, _sync_base: base }, attempts: 0,
          last_error: null, last_attempt_at: null,
        })
      }
    }
    await db.financialOutbox.delete(envelope.user_id)
  })
}

export async function pushAtomicFinancialBatch(userId: string, force: boolean,
  isDue: (item: LocalSyncQueue) => boolean): Promise<number> {
  let envelope: FinancialOutbox | null = null
  try {
    const existing = await db.financialOutbox.get(userId)
    const pending = await getPendingSyncItems(userId)
    // Never split a related operation because only one row's retry is due.
    if (!existing && pending.length && !force && !pending.every(isDue)) return 0
    if (existing && !force) {
      const currentById = new Map(pending.map(item => [item.id, item]))
      if (!existing.queue.every(item => isDue(currentById.get(item.id) ?? item))) return 0
    }
    envelope = await prepareOutbox(userId)
    if (!envelope) return 0
    const { data, error } = await supabase.rpc('dfl_commit_financial_batch', {
      p_batch_id: envelope.id, p_items: envelope.items,
    })
    if (error) throw new Error(error.message)
    if (data?.batch_id !== envelope.id || data?.status !== 'committed' || !data.versions) {
      throw new Error('O servidor não confirmou a operação financeira completa.')
    }
    await acknowledgeOutbox(envelope, data.versions, data.accounts)
    return 0
  } catch (error: any) {
    const message = error?.message || 'Não foi possível confirmar o lote financeiro.'
    const pending = await getPendingSyncItems(userId)
    let failures = 0
    for (const item of pending) {
      if (await markSyncFailedIfCurrent(item.id, item.revision ?? 0, message)) failures++
    }
    // No direct-upsert fallback: an absent RPC or conflict must preserve intent.
    return failures || 1
  }
}
