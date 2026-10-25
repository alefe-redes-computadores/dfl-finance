// V220 — Comparação somente de leitura; jamais altera o ledger.
export function pressureScenarioComparison(input: {
  baseline: number | null
  simulated: number | null
  extraExpense: number | null
  loading: boolean
}) {
  if (
    input.loading ||
    input.baseline === null ||
    input.simulated === null ||
    input.extraExpense === null ||
    !Number.isFinite(input.baseline) ||
    !Number.isFinite(input.simulated) ||
    !Number.isFinite(input.extraExpense)
  ) {
    return {
      ready: false as const,
      impact: null,
      label: 'Comparação indisponível',
      explanation: 'Revise os valores ou aguarde os dados locais.'
    }
  }
  const impact = Math.round(
    (input.simulated - input.baseline) * 100
  ) / 100
  return {
    ready: true as const,
    impact,
    label: impact < 0
      ? 'Redução no cenário simulado'
      : impact > 0
        ? 'Aumento no cenário simulado'
        : 'Sem diferença no cenário',
    explanation: 'Diferença em relação ao cenário conservador, sem receitas futuras. Não é movimentação bancária.'
  }
}
