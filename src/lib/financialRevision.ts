const LOCAL_KEYS = new Set(['_sync_base', 'sync_status', 'sync_attempts', 'last_sync_error'])
function semanticValue(value: any): any {
  if (Array.isArray(value)) return value.map(semanticValue)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .filter(key => !LOCAL_KEYS.has(key)).map(key => [key, semanticValue(value[key])]))
  return value
}
export const transactionRevisionSignature = (row: any): string => JSON.stringify(semanticValue(row))

/** Protect against a stale screen, including two edits sharing the same millisecond. */
export function assertTransactionUnchanged(expected: any, current: any, userId: string) {
  if (!current || !expected || current.user_id !== userId || expected.user_id !== userId ||
    transactionRevisionSignature(current) !== transactionRevisionSignature(expected)) {
    throw new Error('Esta transação mudou desde que foi aberta. Reabra antes de confirmar; nenhum saldo foi alterado.')
  }
}
