// V210 — Interpreta planejamento, nao calcula saldo nem altera ledger.
export type PlanningDecisionInput = {
  flexibleLimit: number | null
  flexibleRemaining: number | null
  flexiblePaceDelta: number | null
  reserveOutstanding: number
  reserveMonthlySuggested: number
  reserveCount: number
}

export function planningDecision(input: PlanningDecisionInput) {
  const valid = (n: number | null): n is number =>
    n !== null && Number.isFinite(n)

  const reserve = Number.isFinite(input.reserveOutstanding)
    ? Math.max(0, input.reserveOutstanding) : 0
  const monthly = Number.isFinite(input.reserveMonthlySuggested)
    ? Math.max(0, input.reserveMonthlySuggested) : 0

  const excess = valid(input.flexiblePaceDelta)
    ? input.flexiblePaceDelta > 0 : false

  const limitReached = valid(input.flexibleLimit)
    && input.flexibleLimit > 0
    && valid(input.flexibleRemaining)
    && input.flexibleRemaining <= 0

  const hasLimit = valid(input.flexibleLimit)
    && input.flexibleLimit > 0

  const title = limitReached
    ? 'Limite flexível atingido'
    : excess
      ? 'Gastos flexíveis acima do ritmo'
      : !hasLimit
        ? 'Defina seu limite flexível'
        : 'Acompanhe seu ritmo de gastos'

  const explanation = limitReached
    ? 'O limite definido foi consumido. Isso não significa saldo bancário negativo.'
    : excess
      ? 'O ritmo de gastos flexíveis está acima da referência proporcional do mês.'
      : !hasLimit
        ? 'Sem limite configurado, não é possível avaliar o ritmo flexível.'
        : 'O limite serve para orientar gastos, não para representar dinheiro em caixa.'

  return {
    title,
    explanation,
    hasLimit,
    limitReached,
    excess,
    reservePending: reserve > 0,
    reserveCount: Math.max(0, Math.floor(
      Number.isFinite(input.reserveCount) ? input.reserveCount : 0
    )),
    reserveOutstanding: reserve,
    reserveMonthlySuggested: monthly
  }
}
