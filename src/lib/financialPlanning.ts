import type { FinancialIntelligenceOutput, IntelligenceTransactionLike } from '@/lib/financial-intelligence'

const n = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const money = (value: number) => Math.round(value * 100) / 100
const dateOnly = (value: unknown) => String(value || '').slice(0, 10)
const iso = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const monthEnd = (date: Date) => iso(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12))

export interface FinancialPlanSnapshot {
  realizedIncome: number
  realizedExpense: number
  realizedNet: number
  committedPayables: number
  probableReceivables: number
  estimatedRemainingExpense: number
  estimatedRemainingIncome: number
  knownCommitmentNet: number
  recurringMonthly: number
  cardExposure: number
  creditCommitments: number
  availableAfterKnownCommitments: number
  projectedMonthNet: number
  projectedMonthEndCash: number
  confidence: 'low' | 'medium' | 'high'
  sampleSize: number
}

export interface FinancialScenarioInput {
  extraIncomeMonthly: number
  expenseReductionMonthly: number
  debtAllocationNow: number
}

export interface FinancialScenarioResult {
  baseline30: number
  scenario30: number
  baseline90: number
  scenario90: number
  improvement30: number
  improvement90: number
  debtAllocationNow: number
  note: string
}

export interface FinancialTimelineDay {
  date: string
  income: number
  expense: number
  net: number
  projectedCash: number
  events: number
}

export interface FinancialCashTimeline {
  days: FinancialTimelineDay[]
  firstRiskDate: string | null
  lowestCash: number
  knownIncome: number
  knownExpense: number
}

export type FinancialDiscoveryTone =
  | 'critical'
  | 'warning'
  | 'opportunity'
  | 'stable'

export interface FinancialDiscovery {
  id: string
  tone: FinancialDiscoveryTone
  title: string
  message: string
  evidence: string
}

export function buildFinancialPlan(
  intelligence: FinancialIntelligenceOutput,
  transactions: IntelligenceTransactionLike[],
  now = new Date()
): FinancialPlanSnapshot {
  const snapshot = intelligence.snapshot
  const today = iso(now)
  const end = monthEnd(now)
  const pending = transactions.filter((tx) => {
    if (tx.context !== intelligence.context || tx.status !== 'pending') return false
    const date = dateOnly(tx.date)
    return Boolean(date) && date >= today && date <= end
  })

  const committedPayables = pending.reduce((sum, tx) =>
    tx.type === 'expense' || tx.type === 'sangria' ? sum + Math.abs(n(tx.amount)) : sum, 0)
  const probableReceivables = pending.reduce((sum, tx) =>
    tx.type === 'income' ? sum + Math.abs(n(tx.amount)) : sum, 0)
  const projectedMonthIncome =
    n(snapshot.projectedMonthNet) +
    n(snapshot.projectedMonthExpense)

  const estimatedRemainingExpense = Math.max(
    0,
    n(snapshot.projectedMonthExpense) -
      n(snapshot.currentMonthExpense) -
      committedPayables
  )

  const estimatedRemainingIncome = Math.max(
    0,
    projectedMonthIncome -
      n(snapshot.currentMonthIncome) -
      probableReceivables
  )

  const knownCommitmentNet =
    probableReceivables - committedPayables

  const futureNet =
    knownCommitmentNet +
    estimatedRemainingIncome -
    estimatedRemainingExpense

  const creditCommitments =
    n(snapshot.activeLoanRemaining) + n(snapshot.activeFinancingRemaining)

  return {
    realizedIncome: money(snapshot.currentMonthIncome),
    realizedExpense: money(snapshot.currentMonthExpense),
    realizedNet: money(snapshot.currentMonthNet),
    committedPayables: money(committedPayables),
    probableReceivables: money(probableReceivables),
    estimatedRemainingExpense: money(estimatedRemainingExpense),
    estimatedRemainingIncome: money(estimatedRemainingIncome),
    knownCommitmentNet: money(knownCommitmentNet),
    recurringMonthly: money(snapshot.recurringMonthlyEquivalent),
    cardExposure: money(snapshot.creditCardOpenExposure),
    creditCommitments: money(creditCommitments),
    availableAfterKnownCommitments: money(
      snapshot.accountBalance - committedPayables + probableReceivables
    ),
    projectedMonthNet: money(
      n(snapshot.currentMonthNet) + futureNet
    ),
    projectedMonthEndCash: money(
      n(snapshot.accountBalance) + futureNet
    ),
    confidence: snapshot.confidence,
    sampleSize: snapshot.sampleSize,
  }
}

export function buildKnownCashTimeline(
  intelligence: FinancialIntelligenceOutput,
  transactions: IntelligenceTransactionLike[],
  days = 30,
  now = new Date()
): FinancialCashTimeline {
  const horizon = Math.max(1, Math.min(90, Math.trunc(days) || 30))
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12
  )

  const byDate = new Map<
    string,
    { income: number; expense: number; events: number }
  >()

  for (const tx of transactions) {
    if (
      tx.context !== intelligence.context ||
      tx.status !== 'pending'
    ) {
      continue
    }

    const date = dateOnly(tx.date)
    if (!date) continue

    const parsed = new Date(`${date}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) continue

    const distance = Math.floor(
      (parsed.getTime() - start.getTime()) / 86_400_000
    )

    if (distance < 0 || distance >= horizon) continue

    const current = byDate.get(date) || {
      income: 0,
      expense: 0,
      events: 0,
    }

    const amount = Math.abs(n(tx.amount))

    if (tx.type === 'income') {
      current.income += amount
    } else if (
      tx.type === 'expense' ||
      tx.type === 'sangria'
    ) {
      current.expense += amount
    } else {
      continue
    }

    current.events += 1
    byDate.set(date, current)
  }

  let cash = n(intelligence.snapshot.accountBalance)
  let lowestCash = cash
  let firstRiskDate: string | null = cash < 0 ? iso(start) : null
  let knownIncome = 0
  let knownExpense = 0

  const timeline: FinancialTimelineDay[] = []

  for (let index = 0; index < horizon; index++) {
    const day = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate() + index,
      12
    )

    const date = iso(day)
    const flow = byDate.get(date) || {
      income: 0,
      expense: 0,
      events: 0,
    }

    const income = money(flow.income)
    const expense = money(flow.expense)
    const net = money(income - expense)

    cash = money(cash + net)
    knownIncome += income
    knownExpense += expense
    lowestCash = Math.min(lowestCash, cash)

    if (cash < 0 && !firstRiskDate) {
      firstRiskDate = date
    }

    // Dias vazios não precisam poluir a UI.
    // O dia do primeiro risco é preservado mesmo sem evento.
    if (flow.events > 0 || date === firstRiskDate) {
      timeline.push({
        date,
        income,
        expense,
        net,
        projectedCash: cash,
        events: flow.events,
      })
    }
  }

  return {
    days: timeline,
    firstRiskDate,
    lowestCash: money(lowestCash),
    knownIncome: money(knownIncome),
    knownExpense: money(knownExpense),
  }
}

export function buildFinancialDiscoveries(
  plan: FinancialPlanSnapshot,
  timeline: FinancialCashTimeline
): FinancialDiscovery[] {
  const discoveries: FinancialDiscovery[] = []

  if (timeline.firstRiskDate) {
    discoveries.push({
      id: 'known-cash-risk',
      tone: 'critical',
      title: 'Risco de caixa identificado',
      message: `Com os compromissos já cadastrados, o saldo cruza abaixo de zero em ${timeline.firstRiskDate.split('-').reverse().join('/')}.`,
      evidence: `Menor saldo conhecido no horizonte: ${money(timeline.lowestCash).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    })
  } else if (plan.availableAfterKnownCommitments < 0) {
    discoveries.push({
      id: 'commitment-pressure',
      tone: 'warning',
      title: 'Compromissos pressionam o caixa',
      message: 'O saldo atual não cobre todos os compromissos conhecidos considerados no mês.',
      evidence: `Livre após compromissos: ${money(plan.availableAfterKnownCommitments).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    })
  }

  if (plan.projectedMonthNet < 0) {
    discoveries.push({
      id: 'negative-month-trend',
      tone: 'warning',
      title: 'Ritmo do mês está negativo',
      message: 'A projeção atual indica que o mês pode terminar consumindo caixa.',
      evidence: `Resultado projetado do mês: ${money(plan.projectedMonthNet).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    })
  }

  if (
    plan.cardExposure > 0 &&
    plan.cardExposure > Math.max(1, plan.realizedIncome) * 0.5
  ) {
    discoveries.push({
      id: 'card-exposure',
      tone: 'warning',
      title: 'Cartões concentram compromisso relevante',
      message: 'As faturas abertas representam uma parcela importante da receita realizada no período.',
      evidence: `Exposição aberta: ${money(plan.cardExposure).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
    })
  }

  if (
    !timeline.firstRiskDate &&
    plan.projectedMonthNet >= 0 &&
    plan.availableAfterKnownCommitments >= 0
  ) {
    discoveries.push({
      id: 'stable-known-cash',
      tone: 'stable',
      title: 'Caixa conhecido está saudável',
      message: 'Os compromissos cadastrados não indicam ruptura de caixa no horizonte conhecido.',
      evidence: `${timeline.days.length} dia(s) com eventos financeiros conhecidos foram analisados.`,
    })
  }

  if (plan.confidence === 'low') {
    discoveries.push({
      id: 'low-confidence',
      tone: 'opportunity',
      title: 'Projeção ainda tem pouca amostra',
      message: 'Use a projeção como orientação, não como promessa. Mais histórico melhora a leitura do comportamento.',
      evidence: `${plan.sampleSize} lançamento(s) compõem a amostra atual.`,
    })
  }

  return discoveries.slice(0, 4)
}

export function simulateFinancialScenario(
  plan: FinancialPlanSnapshot,
  input: FinancialScenarioInput
): FinancialScenarioResult {
  const extraIncome = Math.max(0, n(input.extraIncomeMonthly))
  const reduction = Math.max(0, n(input.expenseReductionMonthly))
  const debtNow = Math.max(0, n(input.debtAllocationNow))
  const monthlyImprovement = extraIncome + reduction
  const baseline30 = plan.projectedMonthEndCash
  const scenario30 = baseline30 + monthlyImprovement - debtNow
  const baseline90 = plan.projectedMonthEndCash + (plan.projectedMonthNet * 2)
  const scenario90 = baseline90 + (monthlyImprovement * 3) - debtNow

  return {
    baseline30: money(baseline30),
    scenario30: money(scenario30),
    baseline90: money(baseline90),
    scenario90: money(scenario90),
    improvement30: money(monthlyImprovement),
    improvement90: money(monthlyImprovement * 3),
    debtAllocationNow: money(debtNow),
    note: debtNow > 0
      ? 'A antecipação reduz o caixa imediatamente. Como os contratos não informam economia futura de juros de forma uniforme, o simulador não inventa esse ganho.'
      : 'Cenário educativo baseado no ritmo atual; nenhuma alteração é gravada no seu financeiro.',
  }
}
