/**
 * R426 — Facetas da Busca 360.
 * Somente resultados já obtidos do IndexedDB para usuário/contexto atual.
 * Sem chamadas, persistência, totais financeiros ou outras fontes.
 */
import type { GlobalSearchResult } from '@/lib/globalSearch'

export type FinancialSearchFacetId =
  | 'income' | 'expense' | 'transfer' | 'account' | 'card'
  | 'debt' | 'loan' | 'financing' | 'subscription' | 'goal' | 'category'
  | 'tag' | 'budget' | 'contact' | 'invoice'
export type FinancialSearchFacet = { id: FinancialSearchFacetId; count: number }

const ORDER: readonly FinancialSearchFacetId[] = [
  'expense', 'income', 'transfer', 'account', 'card', 'debt',
  'loan', 'financing', 'subscription', 'goal', 'category',
  'tag', 'budget', 'contact', 'invoice'
]

/** Classificação única para chip e filtro avançado; registros desconhecidos ficam sem faceta. */
export function financialSearchFacet(
  item: Pick<GlobalSearchResult, 'kind' | 'transactionType'>
): FinancialSearchFacetId | null {
  if (item.kind !== 'transaction') {
    return ORDER.includes(item.kind as FinancialSearchFacetId)
      ? item.kind as FinancialSearchFacetId : null
  }
  const type = String(item.transactionType ?? '').toLowerCase()
  if (type === 'expense' || type === 'sangria') return 'expense'
  if (type === 'income') return 'income'
  if (type === 'transfer') return 'transfer'
  return null
}

/** Contagem de resultados visíveis no lote (máximo 40), nunca do banco inteiro. */
export function buildFinancialSearchFacets(
  items: readonly Pick<GlobalSearchResult, 'kind' | 'transactionType'>[]
): FinancialSearchFacet[] {
  const counts = new Map<FinancialSearchFacetId, number>()
  for (const item of items) {
    const id = financialSearchFacet(item)
    if (!id) continue
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return ORDER.filter(id => (counts.get(id) ?? 0) > 0)
    .map(id => ({ id, count: counts.get(id)! }))
    .sort((a, b) => b.count - a.count || ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
}
