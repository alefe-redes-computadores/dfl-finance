export type SubscriptionBillingCycle =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannually'
  | 'yearly'

export type SubscriptionStatus =
  | 'active'
  | 'paused'
  | 'cancelled'

export const SUBSCRIPTION_CYCLES: Array<{
  value: SubscriptionBillingCycle
  label: string
  shortLabel: string
}> = [
  {
    value: 'monthly',
    label: 'Mensal',
    shortLabel: 'mensal',
  },
  {
    value: 'weekly',
    label: 'Semanal',
    shortLabel: 'semanal',
  },
  {
    value: 'quarterly',
    label: 'Trimestral',
    shortLabel: 'trimestral',
  },
  {
    value: 'semiannually',
    label: 'Semestral',
    shortLabel: 'semestral',
  },
  {
    value: 'yearly',
    label: 'Anual',
    shortLabel: 'anual',
  },
]

export const SUBSCRIPTION_STATUS_LABELS: Record<
  SubscriptionStatus,
  string
> = {
  active: 'Ativa',
  paused: 'Pausada',
  cancelled: 'Cancelada',
}

export function subscriptionCycleLabel(
  cycle?: string | null
) {
  return (
    SUBSCRIPTION_CYCLES.find(
      (item) => item.value === cycle
    )?.label ??
    cycle ??
    'Não informado'
  )
}

export function subscriptionCycleShortLabel(
  cycle?: string | null
) {
  return (
    SUBSCRIPTION_CYCLES.find(
      (item) => item.value === cycle
    )?.shortLabel ??
    cycle ??
    'recorrente'
  )
}

export function subscriptionMonthlyEquivalent(
  amountValue: unknown,
  cycle?: string | null
) {
  const amount = Number(amountValue)

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0
  }

  switch (cycle) {
    case 'weekly':
      return amount * 52 / 12

    case 'quarterly':
      return amount / 3

    case 'semiannually':
      return amount / 6

    case 'yearly':
      return amount / 12

    default:
      return amount
  }
}

export function subscriptionDueDay(
  nextDueDate?: string | null
) {
  if (!nextDueDate) {
    return null
  }

  const iso =
    String(nextDueDate)
      .split('T')[0]

  const match =
    /^\d{4}-\d{2}-(\d{2})$/
      .exec(iso)

  if (!match) {
    return null
  }

  const day = Number(match[1])

  if (
    !Number.isInteger(day) ||
    day < 1 ||
    day > 31
  ) {
    return null
  }

  return day
}

export function formatSubscriptionDate(
  value?: string | null
) {
  if (!value) {
    return 'Não informada'
  }

  const iso =
    String(value)
      .split('T')[0]

  const [
    year,
    month,
    day,
  ] = iso.split('-')

  if (
    !year ||
    !month ||
    !day
  ) {
    return value
  }

  return `${day}/${month}/${year}`
}

export function formatSubscriptionDateShort(
  value?: string | null
) {
  if (!value) {
    return ''
  }

  const iso =
    String(value)
      .split('T')[0]

  const [
    year,
    month,
    day,
  ] = iso.split('-')

  if (
    !year ||
    !month ||
    !day
  ) {
    return value
  }

  const date =
    new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      12,
      0,
      0
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value
  }

  return date.toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: 'short',
    }
  )
}

export function isActiveSubscription(
  status?: string | null
) {
  return status === 'active'
}
