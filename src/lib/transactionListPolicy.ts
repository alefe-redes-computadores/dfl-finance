// V199 — Contratos puros de consulta local.
// Nenhuma operação de escrita, rede ou sincronização.

export function invalidTransactionDateRange(
  startDate?: string | null,
  endDate?: string | null
): boolean {
  return Boolean(startDate && endDate && startDate > endDate)
}

export function transactionStableIdCompare(
  a: { id?: unknown },
  b: { id?: unknown }
): number {
  return String(b.id ?? '').localeCompare(String(a.id ?? ''))
}

// V201: a consulta Dexie ja restringe o usuario.
// Filtros externos nunca podem substituir esse isolamento.
export type TransactionFilter = readonly [string, unknown]

export function activeTransactionFilters(
  filters?: Record<string, unknown>
): TransactionFilter[] {
  return Object.entries(filters || {}).filter(
    ([key, value]) =>
      key !== 'user_id' &&
      value !== undefined &&
      value !== null &&
      value !== ''
  )
}

export function transactionMatchesFilters(
  item: Record<string, unknown>,
  activeFilters: readonly TransactionFilter[]
): boolean {
  return activeFilters.every(
    ([key, value]) => item[key] === value
  )
}
