/** Texto temporario, consumo unico, sem query string e sem envio ao servidor. */
const KEY = 'dfl.finance.search.contextual.v1'
const TTL = 60_000
export function stageContextualSearchQuery(value: string): boolean {
  if (typeof window === 'undefined') return false
  const query = value.trim().slice(0, 120)
  if (!query) return false
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ query, at: Date.now() }))
    return true
  } catch { return false }
}
export function consumeContextualSearchQuery(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    window.sessionStorage.removeItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { query?: unknown; at?: unknown }
    if (typeof data.at !== 'number' || data.at > Date.now() + 5000 || Date.now() - data.at > TTL) return null
    if (typeof data.query !== 'string') return null
    return data.query.trim().slice(0, 120) || null
  } catch { return null }
}
