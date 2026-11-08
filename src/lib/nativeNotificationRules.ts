/** R457 — políticas puras do agendador financeiro. Sem I/O, tokens ou escrita financeira. */
export const NOTIFICATION_KINDS = [
  'invoices', 'transactions', 'debts', 'financings',
  'loans', 'subscriptions', 'goals',
] as const

export type NotificationKind = typeof NOTIFICATION_KINDS[number]

export type NotificationRule = {
  leadDays: number[]
  hour: number
  overdueEveryDays: number
  overdueMaxDays: number
  minimumAmount: number
}

export type NotificationRuleOverrides = Partial<Record<NotificationKind, Partial<NotificationRule>>>

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)

const finiteInteger = (value: unknown, fallback: number, low: number, high: number) =>
  typeof value === 'number' && Number.isInteger(value) && value >= low && value <= high
    ? value : fallback

export function normalizeLeadDays(value: unknown, fallback: number[] = [3, 1, 0]): number[] {
  if (!Array.isArray(value)) return [...fallback]
  const unique = Array.from(new Set(value.filter(
    (item): item is number => typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 30
  )))
  return unique.sort((a, b) => b - a)
}

export function normalizeNotificationRules(value: unknown): NotificationRuleOverrides {
  if (!isRecord(value)) return {}
  const rules: NotificationRuleOverrides = {}
  for (const kind of NOTIFICATION_KINDS) {
    const raw = value[kind]
    if (!isRecord(raw)) continue
    rules[kind] = {
      ...(Array.isArray(raw.leadDays) ? { leadDays: normalizeLeadDays(raw.leadDays) } : {}),
      ...(typeof raw.hour === 'number' ? { hour: finiteInteger(raw.hour, 9, 6, 21) } : {}),
      ...(typeof raw.overdueEveryDays === 'number'
        ? { overdueEveryDays: [0, 1, 2, 3, 7].includes(raw.overdueEveryDays) ? raw.overdueEveryDays : 0 }
        : {}),
      ...(typeof raw.overdueMaxDays === 'number'
        ? { overdueMaxDays: [7, 14, 30].includes(raw.overdueMaxDays) ? raw.overdueMaxDays : 14 }
        : {}),
      ...(typeof raw.minimumAmount === 'number'
        ? { minimumAmount: Number.isFinite(raw.minimumAmount) ? Math.max(0, Math.min(1000000, raw.minimumAmount)) : 0 }
        : {}),
    }
  }
  return rules
}

/** Preferências globais legadas são o fallback para categorias sem personalização. */
export function resolveNotificationRule(
  kind: NotificationKind,
  preferences: {
    notification_hour?: number
    notification_lead_days?: number[]
    notification_overdue?: boolean
    notification_rules?: NotificationRuleOverrides
  },
): NotificationRule {
  const override = preferences.notification_rules?.[kind]
  return {
    leadDays: normalizeLeadDays(override?.leadDays ?? preferences.notification_lead_days),
    hour: finiteInteger(override?.hour ?? preferences.notification_hour, 9, 6, 21),
    overdueEveryDays: preferences.notification_overdue === false ? 0
      : finiteInteger(override?.overdueEveryDays, 1, 0, 7),
    overdueMaxDays: finiteInteger(override?.overdueMaxDays, 14, 7, 30),
    minimumAmount: typeof override?.minimumAmount === 'number' && Number.isFinite(override.minimumAmount)
      ? Math.max(0, Math.min(1000000, override.minimumAmount)) : 0,
  }
}

export type ReminderOccurrence = {
  at: Date
  suffix: string
  leadDays: number
  overdue: boolean
}

/** Datas civis estritas: evita rollover silencioso de 31/02 e não usa UTC. */
export function civilReminderDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.slice(0, 10))
  if (!match) return null
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3])
  if (year < 2000 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day, 12)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

function atDayOffset(due: Date, dayOffset: number, hour: number): Date {
  return new Date(due.getFullYear(), due.getMonth(), due.getDate() + dayOffset, hour, 0, 0, 0)
}

/** Horizonte de 60 dias; atrasos nunca disparam no passado nem após o limite configurado. */
export function reminderOccurrences(
  dueDate: string,
  rule: NotificationRule,
  reference = new Date(),
): ReminderOccurrence[] {
  const due = civilReminderDate(dueDate)
  if (!due) return []
  const earliest = reference.getTime() + 60_000
  const horizon = reference.getTime() + 60 * 24 * 60 * 60 * 1000
  const results: ReminderOccurrence[] = []
  for (const days of normalizeLeadDays(rule.leadDays, [])) {
    const at = atDayOffset(due, -days, rule.hour)
    if (at.getTime() > earliest && at.getTime() <= horizon) {
      results.push({ at, suffix: `lead:${days}`, leadDays: days, overdue: false })
    }
  }
  const interval = rule.overdueEveryDays
  if ([1, 2, 3, 7].includes(interval)) {
    for (let after = 1; after <= rule.overdueMaxDays; after += interval) {
      const at = atDayOffset(due, after, rule.hour)
      if (at.getTime() > earliest && at.getTime() <= horizon) {
        results.push({ at, suffix: `overdue:${after}`, leadDays: 0, overdue: true })
      }
    }
  }
  return results.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/** Compara somente campos estáveis; não remarca toda a agenda ao reabrir o app. */
export function sameScheduledReminder(
  existing: { id: number; extra?: Record<string, unknown> },
  desired: { id: number; extra?: Record<string, unknown> },
): boolean {
  return existing.id === desired.id &&
    existing.extra?.managedBy === 'dfl-finance' &&
    typeof existing.extra?.signature === 'string' &&
    existing.extra.signature === desired.extra?.signature
}
