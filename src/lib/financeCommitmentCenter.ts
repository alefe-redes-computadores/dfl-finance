// V178 — Central consultiva de compromissos.
// Agenda V170 é autoridade das obrigações.
// Radar V174 é autoridade dos cenários de caixa.
// Nenhuma alteração de ledger, saldo ou sincronização.

import type {
  AgendaEntry,
  AgendaResult
} from './financeAgenda'

import type {
  PressureSnapshot
} from './financePressure'

export type CenterPriority = {
  id: string
  level: 'critical' | 'warning' | 'info'
  title: string
  detail: string
  href: string
}

export type CenterBucket = {
  id: 'overdue' | 'week' | 'month' | 'later'
  label: string
  expense: number
  income: number
  count: number
  items: AgendaEntry[]
}

export type CenterResult = {
  today: string
  end: string
  days: number
  openingBalance: number | null
  endConservative: number | null
  worstConservative: number | null
  endWithReceipts: number | null
  firstNegativeDate: string | null
  overdueExpense: number
  knownExpense: number
  possibleIncome: number
  planningExpense: number
  knownCount: number
  planningCount: number
  buckets: CenterBucket[]
  priorities: CenterPriority[]
  warnings: string[]
}

const money = (n: number) =>
  Math.round(n * 100) / 100

const valid = (n: unknown): n is number =>
  typeof n === 'number' &&
  Number.isFinite(n) &&
  n > 0

const shift = (iso: string, delta: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(
    Date.UTC(y, m - 1, d + delta, 12)
  ).toISOString().slice(0, 10)
}

/**
 * Faz a triagem dos mesmos eventos já reconhecidos.
 *
 * Não recontabiliza faturas, assinaturas ou transferências.
 * Eventos planning nunca entram nos totais conhecidos.
 * Recebíveis não entram no cenário conservador.
 *
 * O radar continua sendo a única autoridade sobre a
 * trajetória de caixa.
 */
export function buildCommitmentCenter(
  agenda: AgendaResult,
  pressure: PressureSnapshot
): CenterResult {
  if (
    agenda.today !== pressure.today ||
    agenda.end !== pressure.end ||
    agenda.horizonDays !== pressure.days
  ) {
    throw new Error('V178: horizontes inconsistentes')
  }

  const today = agenda.today
  const weekEnd = shift(today, 6)
  const monthEnd = shift(today, 29)

  const buckets: CenterBucket[] = [
    {
      id: 'overdue',
      label: 'Vencidos',
      expense: 0,
      income: 0,
      count: 0,
      items: []
    },
    {
      id: 'week',
      label: 'Hoje e próximos 7 dias',
      expense: 0,
      income: 0,
      count: 0,
      items: []
    },
    {
      id: 'month',
      label: 'Dias 8 a 30',
      expense: 0,
      income: 0,
      count: 0,
      items: []
    },
    {
      id: 'later',
      label: 'Dias 31 a 90',
      expense: 0,
      income: 0,
      count: 0,
      items: []
    }
  ]

  const unique = new Set<string>()
  let planning = 0
  let planningCount = 0

  for (const entry of agenda.items) {
    if (
      !entry ||
      !entry.id ||
      !entry.date ||
      entry.date > agenda.end ||
      !valid(entry.amount)
    ) continue

    if (unique.has(entry.id)) continue
    unique.add(entry.id)

    if (entry.scope === 'planning') {
      if (entry.direction === 'expense') {
        planning += entry.amount
        planningCount++
      }
      continue
    }

    if (entry.scope !== 'known') continue

    const bucket = entry.date < today
      ? buckets[0]
      : entry.date <= weekEnd
        ? buckets[1]
        : entry.date <= monthEnd
          ? buckets[2]
          : buckets[3]

    bucket.items.push(entry)
    bucket.count++

    if (entry.direction === 'expense') {
      bucket.expense += entry.amount
    } else if (entry.direction === 'income') {
      bucket.income += entry.amount
    }
  }

  for (const bucket of buckets) {
    bucket.expense = money(bucket.expense)
    bucket.income = money(bucket.income)

    bucket.items.sort((a, b) =>
      a.date.localeCompare(b.date) ||
      a.id.localeCompare(b.id)
    )
  }

  const priorities: CenterPriority[] = []

  const add = (
    id: string,
    level: CenterPriority['level'],
    title: string,
    detail: string,
    href: string
  ) => priorities.push({
    id, level, title, detail, href
  })

  if (buckets[0].expense > 0) {
    add(
      'overdue',
      'critical',
      'Obrigações vencidas',
      `${buckets[0].count} evento(s) vencido(s) na agenda; confira os pagamentos ainda pendentes.`,
      '/agenda'
    )
  }

  if (pressure.firstNegativeDate) {
    add(
      'negative',
      'critical',
      'Possível insuficiência de caixa',
      `O cenário conservador do Radar apresenta posição negativa a partir de ${pressure.firstNegativeDate}. Não significa que o saldo real já esteja negativo.`,
      '/cash-pressure'
    )
  }

  if (buckets[1].expense > 0) {
    add(
      'week',
      'warning',
      'Compromissos próximos',
      `Há obrigações conhecidas somando ${money(buckets[1].expense).toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL'
      })} nos próximos sete dias, incluindo hoje.`,
      '/agenda'
    )
  }

  if (pressure.openingBalance === null) {
    add(
      'balance',
      'warning',
      'Saldo inicial desconhecido',
      'Nenhuma conta ativa com saldo válido foi encontrada para calcular o cenário de caixa.',
      '/accounts'
    )
  }

  if (agenda.horizonIncome > 0) {
    add(
      'receivables',
      'info',
      'Recebíveis ainda não realizados',
      'Há receitas previstas na Agenda. Elas aparecem separadamente e não reforçam o cenário conservador.',
      '/agenda'
    )
  }

  if (planning > 0) {
    add(
      'planning',
      'info',
      'Assinaturas previstas separadas',
      'Compromissos planejados são informativos e não foram acrescentados às obrigações confirmadas.',
      '/planning'
    )
  }

  const warnings = Array.from(new Set([
    ...agenda.warnings,
    ...pressure.warnings
  ]))

  return {
    today,
    end: agenda.end,
    days: agenda.horizonDays,
    openingBalance: pressure.openingBalance,
    endConservative: pressure.endConservative,
    worstConservative: pressure.worstConservative,
    endWithReceipts: pressure.endWithReceipts,
    firstNegativeDate: pressure.firstNegativeDate,
    overdueExpense: money(buckets[0].expense),
    knownExpense: money(
      buckets.reduce((s, b) => s + b.expense, 0)
    ),
    possibleIncome: money(
      buckets.reduce((s, b) => s + b.income, 0)
    ),
    planningExpense: money(planning),
    knownCount: buckets.reduce((s, b) => s + b.count, 0),
    planningCount,
    buckets,
    priorities,
    warnings
  }
}
