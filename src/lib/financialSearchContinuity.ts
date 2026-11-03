/**
 * R424 — identidade efemera da consulta local.
 * Nenhuma persistencia; resultados nunca atravessam usuario, contexto,
 * texto ou uma tentativa de pesquisa.
 */
export type FinancialSearchContext = 'dfl' | 'personal'
export type FinancialSearchPhase = 'idle' | 'loading' | 'ready' | 'error'

export function financialSearchRequestKey(
  userId: string | null | undefined,
  context: FinancialSearchContext,
  query: string,
  attempt: number
): string {
  if (!userId || (context !== 'dfl' && context !== 'personal') ||
      !query.trim() || !Number.isSafeInteger(attempt) || attempt < 0) return ''
  // JSON preserva separadores, acentos e consultas com caracteres especiais.
  return JSON.stringify([userId, context, query.trim(), attempt])
}

export function financialSearchPhase(
  requestKey: string,
  resolvedKey: string,
  failedKey: string,
  loading: boolean
): FinancialSearchPhase {
  if (!requestKey) return 'idle'
  if (failedKey === requestKey) return 'error'
  if (loading || resolvedKey !== requestKey) return 'loading'
  return 'ready'
}
