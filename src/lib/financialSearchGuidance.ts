/** R427 — orientacao contextual limitada aos resultados da consulta local atual. */
import type { GlobalSearchResult } from '@/lib/globalSearch'
import type { FinancialSearchFacet, FinancialSearchFacetId } from '@/lib/financialSearchFacets'

export type FinancialResultGuidance =
  | { kind: 'open'; title: string; detail: string; actionLabel: string; item: GlobalSearchResult }
  | { kind: 'refine'; title: string; detail: string; actionLabel: string; facet: FinancialSearchFacetId; count: number }

const NAMES: Partial<Record<FinancialSearchFacetId, string>> = {
  income: 'receitas', expense: 'despesas', transfer: 'transferências',
  account: 'contas', card: 'cartões', debt: 'valores a receber',
  loan: 'empréstimos', financing: 'financiamentos',
  subscription: 'assinaturas', goal: 'metas', category: 'categorias',
}

const DETAIL_PATHS: Record<string, string> = {
  transaction: '/transactions/details?id=', account: '/accounts/details?id=',
  card: '/cards/details?id=', debt: '/debts/details?id=',
  loan: '/loans/details?id=', financing: '/financings/details?id=',
  subscription: '/subscriptions/details?id=', goal: '/goals/details?id=',
}

/** Nao usa URL arbitraria, resultados remotos, dados agregados ou saldo. */
function safeResult(item: GlobalSearchResult): boolean {
  const prefix = DETAIL_PATHS[item.kind]
  return typeof prefix === 'string' && typeof item.id === 'string' && item.id.length > 0 &&
    item.href === `${prefix}${encodeURIComponent(item.id)}`
}

export function buildFinancialResultGuidance(
  results: readonly GlobalSearchResult[],
  facets: readonly FinancialSearchFacet[],
  preferred: string | null,
  activeFilters: readonly FinancialSearchFacetId[]
): FinancialResultGuidance | null {
  // O chamador garante a chave de usuario/contexto, fase ready e ausencia de loading.
  // Filtros ja ativos nao recebem sugestao concorrente.
  if (!results.length || activeFilters.length > 0) return null

  if (results.length === 1 && safeResult(results[0])) {
    return {
      kind: 'open', title: 'Encontrei um registro',
      detail: 'Um resultado correspondeu a esta busca local. Você pode abri-lo para conferir.',
      actionLabel: 'Abrir registro', item: results[0],
    }
  }

  const requested = preferred as FinancialSearchFacetId | null
  if (!requested || !NAMES[requested] || results.length < 2) return null
  const count = facets.find(facet => facet.id === requested)?.count ?? 0
  if (count < 1 || count >= results.length) return null
  // Um lote pode ter ate 40 itens: nao sugerir que seja uma contagem total do banco.
  return {
    kind: 'refine', title: 'Uma forma de refinar',
    detail: `Neste lote, encontrei ${count} ${NAMES[requested]} entre ${results.length} resultados.`,
    actionLabel: `Ver só ${NAMES[requested]}`, facet: requested, count,
  }
}
