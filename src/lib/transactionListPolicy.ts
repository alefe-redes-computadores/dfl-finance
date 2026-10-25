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
