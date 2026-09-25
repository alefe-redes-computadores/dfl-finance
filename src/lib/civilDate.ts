// src/lib/civilDate.ts

export function localISODate(
  date: Date = new Date()
) {
  const year = date.getFullYear()
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0')
  const day = String(
    date.getDate()
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function parseCivilDate(
  value?: string | null
): Date | null {
  const match = String(value || '')
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  const parsed = new Date(
    year,
    month - 1,
    day,
    12,
    0,
    0,
    0
  )

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

export function toLocalCivilDate(
  value?: string | null
) {
  const civil = parseCivilDate(value)
  if (civil) return civil

  const fallback = new Date(
    String(value || '')
  )

  return Number.isNaN(
    fallback.getTime()
  )
    ? new Date(0)
    : fallback
}

export function formatCivilDateBR(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = {}
) {
  const parsed = parseCivilDate(value)
  if (!parsed) return ''

  return new Intl.DateTimeFormat(
    'pt-BR',
    options
  ).format(parsed)
}
