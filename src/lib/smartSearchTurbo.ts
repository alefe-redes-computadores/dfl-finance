/** R460: autocomplete puro. Quem invoca deve fornecer apenas linhas do usuário/contexto já filtradas no Dexie. */
export type SmartSearchKind = 'income' | 'expense' | 'transfer' | 'sangria'
export interface SmartSearchSuggestion {
  description: string
  category_id: string | null
  account_id: string | null
  credit_card_id: string | null
  amount: number
  type: SmartSearchKind
  count: number
  last_date: string
}
export interface SmartSearchRow {
  description?: string | null
  category_id?: string | null
  account_id?: string | null
  credit_card_id?: string | null
  amount?: number | null
  type?: string | null
  date?: string | null
}

/** Comparação em pt-BR sem depender de locale, rede ou armazenamento. */
export function normalizeSmartLookup(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ')
}

export function collectSmartSearchSuggestions(
  rows: readonly SmartSearchRow[], query: string,
  type?: 'income' | 'expense', limit = 5,
): SmartSearchSuggestion[] {
  const needle = normalizeSmartLookup(query)
  if (needle.length < 2 || !Number.isSafeInteger(limit) || limit < 1) return []
  const grouped = new Map<string, SmartSearchSuggestion>()
  for (const row of rows) {
    const description = typeof row.description === 'string' ? row.description.trim() : ''
    if (!description || !normalizeSmartLookup(description).includes(needle)) continue
    const kind = row.type
    if (type && kind !== type) continue
    if (kind !== 'income' && kind !== 'expense' && kind !== 'transfer' && kind !== 'sangria') continue
    const key = normalizeSmartLookup(description)
    const existing = grouped.get(key)
    const date = typeof row.date === 'string' ? row.date : ''
    const amount = typeof row.amount === 'number' && Number.isFinite(row.amount) ? row.amount : 0
    if (!existing) {
      grouped.set(key, {
        description,
        category_id: row.category_id ?? null,
        account_id: row.account_id ?? null,
        credit_card_id: row.credit_card_id ?? null,
        amount, type: kind, count: 1, last_date: date,
      })
    } else {
      existing.count += 1
      // Datas financeiras são civis (YYYY-MM-DD), sem conversão UTC no caminho comum.
      if (date > existing.last_date) {
        existing.category_id = row.category_id ?? null
        existing.account_id = row.account_id ?? null
        existing.credit_card_id = row.credit_card_id ?? null
        existing.amount = amount
        existing.last_date = date
      }
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.last_date.localeCompare(a.last_date))
    .slice(0, limit)
}
