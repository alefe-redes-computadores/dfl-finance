export type ReserveView = 'urgent' | 'overdue' | 'all' | 'complete'
export type SearchableReserve = {
  id: string
  name: string
  status: 'overdue' | 'upcoming' | 'future' | 'complete'
  outstanding: number
}

function normalize(value: string) {
  return value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim()
}

export function filterPlanningReserves<T extends SearchableReserve>(
  entries: readonly T[],
  view: ReserveView,
  query: string
): T[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  return entries.filter(item => {
    const allowed =
      view === 'all' ||
      (view === 'urgent' && (item.status === 'overdue' || item.status === 'upcoming')) ||
      (view === 'overdue' && item.status === 'overdue') ||
      (view === 'complete' && item.status === 'complete')

    if (!allowed) return false
    const name = normalize(item.name)
    return tokens.every(token => name.includes(token))
  })
}

export function reserveVisibleSummary(
  entries: readonly SearchableReserve[]
) {
  const outstanding = entries.reduce((sum, item) => {
    const amount = Number.isFinite(item.outstanding)
      ? Math.max(0, item.outstanding) : 0
    return sum + amount
  }, 0)
  return {
    count: entries.length,
    outstanding: Math.round(outstanding * 100) / 100
  }
}
