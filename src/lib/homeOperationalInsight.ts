// V206 — Leitura de valores ja calculados. Nao altera saldos.
export function homeOperationalInsight(input: {
  available: number
  committed: number
  reviewCount: number
}): string {
  const { available, committed, reviewCount } = input

  if (!Number.isFinite(available) || !Number.isFinite(committed)) {
    return 'Valores ainda não disponíveis para análise.'
  }

  if (available < 0) {
    return 'Atenção: os compromissos imediatos superam o saldo das contas.'
  }

  if (reviewCount > 0) {
    return 'Existem itens na Inbox que precisam de conferência. Eles podem alterar sua visão financeira.'
  }

  if (committed > 0) {
    return 'Os compromissos imediatos identificados já foram descontados do disponível operacional.'
  }

  return 'Nenhum compromisso imediato identificado neste cálculo.'
}
