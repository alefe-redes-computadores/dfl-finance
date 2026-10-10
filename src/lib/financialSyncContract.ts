import { v5 as uuidV5, validate as isUuid } from 'uuid'

/** Stored only in IndexedDB. Never send this metadata as a table column. */
export type SyncBase = { updated_at: string | null; balance?: number; metadata?: Record<string, any> }
const NAMESPACE = uuidV5('dfl-finance/financial-sync/v1', uuidV5.DNS)

export function financialOperationId(key: string): string {
  return isUuid(key) ? key.toLowerCase() : uuidV5(key, NAMESPACE)
}

export function isTransferMovement(row: any): boolean {
  return row?.type === 'transfer' || Boolean(row?.transfer_group_id)
}

export function expectedSyncBase(row: any, operation: string): SyncBase | undefined {
  if (row?._sync_base) return row._sync_base
  if (row?.sync_status === 'synced' && row?.updated_at) {
    return remoteSyncBase(row)
  }
  if (operation === 'create') return { updated_at: null }
  // Historical pending snapshots have no trustworthy base. Never guess a delta.
  return undefined
}

export function rememberSyncBase(modifications: any, original: any) {
  if (
    modifications.sync_status === 'pending' &&
    original.sync_status === 'synced' &&
    modifications._sync_base === undefined
  ) {
    return { _sync_base: remoteSyncBase(original) }
  }
  return undefined
}

const ACCOUNT_METADATA_KEYS = ['name','bank_slug','context','color','allow_negative','order','type','is_archived','bank','icon']
export function remoteSyncBase(row: any): SyncBase {
  const base: SyncBase = { updated_at: row.updated_at ?? null }
  if (typeof row.balance === 'number' || typeof row.balance === 'string') {
    base.balance = Number(row.balance)
    base.metadata = Object.fromEntries(ACCOUNT_METADATA_KEYS.map(key => [key, row[key] ?? null]))
  }
  return base
}

/** Financial cash effect, independent of economic expense recognition. */
export function transactionCashEffect(row: any): number | null {
  if (row?.status !== 'done' || !row?.account_id) return 0
  const amount = Math.round(Number(row.amount) * 100) / 100
  if (!Number.isFinite(amount)) return null
  if (row.type === 'transfer') {
    if (row.transfer_direction === 'out') return -amount
    if (row.transfer_direction === 'in') return amount
    return null
  }
  if (row.type === 'loan_payment') return typeof row.cash_delta === 'number' ? row.cash_delta : null
  if (row.type === 'financing_installment') return -amount
  if (row.type === 'income' && row.affects_balance !== false) return amount
  if (['expense','sangria'].includes(row.type) && row.affects_balance !== false) return -amount
  if (row.type === 'expense' && row.invoice_id) return -amount
  return typeof row.cash_delta === 'number' ? row.cash_delta : 0
}

export type FinancialBatchItem = {
  table: string
  operation: 'create' | 'update' | 'delete'
  record_id: string
  expected_updated_at: string | null
  base_balance?: number
  base_metadata?: Record<string, any>
  data: Record<string, any> | null
}

export function batchIdentity(items: FinancialBatchItem[]): string {
  // Include immutable payload, not just queue ID. A lost HTTP response repeats
  // the same identity; a later local edit gets a different identity.
  return financialOperationId(JSON.stringify(items))
}
