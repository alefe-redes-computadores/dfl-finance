export type InboxSort = 'priority' | 'date' | 'amount'
export type InboxSortItem = {
  id?: string
  amount?: number | string | null
}
export function sortConciliationView<T extends InboxSortItem>(
  rows: readonly T[],
  mode: InboxSort,
  getDate: (item: T) => string | null | undefined,
  needsReview: (item: T) => boolean,
  today: string
): T[] {
  const amount = (item: T) => {
    const n = Number(item.amount)
    return Number.isFinite(n) ? Math.abs(n) : 0
  }
  const date = (item: T) => {
    const v = getDate(item)
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
      ? v : '9999-12-31'
  }
  const rank = (item: T) => {
    if (needsReview(item)) return 0
    const d = date(item)
    if (d < today) return 1
    if (d === today) return 2
    return 3
  }
  return [...rows].sort((a,b) => {
    if (mode === 'amount') {
      const diff = amount(b) - amount(a)
      if (diff) return diff
    }
    if (mode === 'priority') {
      const diff = rank(a) - rank(b)
      if (diff) return diff
    }
    const chronological = date(a).localeCompare(date(b))
    if (chronological) return chronological
    return String(a.id ?? '').localeCompare(String(b.id ?? ''))
  })
}
