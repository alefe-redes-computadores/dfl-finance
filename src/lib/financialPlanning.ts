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
