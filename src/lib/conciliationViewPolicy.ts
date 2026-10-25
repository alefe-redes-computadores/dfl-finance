export type InboxDirection = 'all' | 'income' | 'expense'
export type InboxSearchItem = {
  description?: string | null
  type?: string | null
  source?: string | null
}
const normalize = (v: unknown) =>
  String(v ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR').trim()

export function filterConciliationView<T extends InboxSearchItem>(
  rows: readonly T[],
  direction: InboxDirection,
  search: string
): T[] {
  const tokens = normalize(search).split(/\s+/).filter(Boolean)
  return rows.filter(item => {
    if (direction === 'income' && item.type !== 'income') return false
    if (direction === 'expense' && item.type === 'income') return false
    const content = normalize(`${item.description ?? ''} ${item.source ?? ''}`)
    return tokens.every(token => content.includes(token))
  })
}
