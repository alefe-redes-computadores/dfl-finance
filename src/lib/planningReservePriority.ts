export type ReserveInput = {
  id: string
  name: string
  target_date: string
  outstanding: number
  monthlySuggested: number
}
export type ReserveStatus = 'overdue' | 'upcoming' | 'future' | 'complete'

function dateMs(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const ms = Date.parse(`${iso}T12:00:00Z`)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString().slice(0, 10) === iso ? ms : null
}

export function planningReservePriorities(
  reserves: readonly ReserveInput[],
  today: string
) {
  const base = dateMs(today)
  if (base === null) throw new Error('Data inválida')

  const entries = reserves.map(r => {
    const due = dateMs(r.target_date)
    const days = due === null ? null : Math.round((due - base) / 86400000)
    const outstanding = Number.isFinite(r.outstanding)
      ? Math.max(0, r.outstanding) : 0
    const monthlySuggested = Number.isFinite(r.monthlySuggested)
      ? Math.max(0, r.monthlySuggested) : 0

    const status: ReserveStatus = outstanding === 0
      ? 'complete'
      : days !== null && days < 0
        ? 'overdue'
        : days !== null && days <= 30
          ? 'upcoming' : 'future'

    return { ...r, days, outstanding, monthlySuggested, status }
  })

  const rank: Record<ReserveStatus, number> = {
    overdue: 0, upcoming: 1, future: 2, complete: 3
  }

  entries.sort((a, b) =>
    rank[a.status] - rank[b.status] ||
    (a.days ?? Infinity) - (b.days ?? Infinity) ||
    a.name.localeCompare(b.name, 'pt-BR') ||
    a.id.localeCompare(b.id)
  )

  return {
    entries,
    overdue: entries.filter(r => r.status === 'overdue').length,
    upcoming: entries.filter(r => r.status === 'upcoming').length,
    complete: entries.filter(r => r.status === 'complete').length
  }
}
