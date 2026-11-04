export type SettlementInput = {
  grossCents: number
  commissionBps: number
  processingBps: number
  fixedFeeCents: number
  retentionCents: number
  adjustmentsCents: number
}

export type SettlementResult = {
  grossCents: number
  commissionCents: number
  processingCents: number
  fixedFeeCents: number
  retentionCents: number
  adjustmentsCents: number
  netCents: number
  payableCents: number
  shortfallCents: number
}

function integer(value: number, name: string, allowNegative = false): number {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) {
    throw new Error(`Valor inválido: ${name}`)
  }
  return value
}

export function calculateSettlement(input: SettlementInput): SettlementResult {
  const grossCents = integer(input.grossCents, 'bruto')
  const commissionBps = integer(input.commissionBps, 'comissão')
  const processingBps = integer(input.processingBps, 'processamento')
  const fixedFeeCents = integer(input.fixedFeeCents, 'taxa fixa')
  const retentionCents = integer(input.retentionCents, 'retenção')
  const adjustmentsCents = integer(input.adjustmentsCents, 'ajustes', true)
  if (commissionBps > 10000 || processingBps > 10000) throw new Error('Percentual acima de 100%')
  const commissionCents = Math.round(grossCents * commissionBps / 10000)
  const processingCents = Math.round(grossCents * processingBps / 10000)
  const netCents = grossCents - commissionCents - processingCents - fixedFeeCents - retentionCents + adjustmentsCents
  if (!Number.isSafeInteger(netCents)) throw new Error('Resultado fora do intervalo seguro')
  return {
    grossCents, commissionCents, processingCents, fixedFeeCents,
    retentionCents, adjustmentsCents, netCents,
    payableCents: Math.max(0, netCents), shortfallCents: Math.max(0, -netCents),
  }
}

export function parseMoneyBR(value: string): number {
  const raw = value.trim().replace(/^R\$\s*/, '').replace(/\s/g, '')
  if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(raw)) throw new Error('Valor monetário inválido')
  const [whole, fraction = ''] = raw.replace(/\./g, '').split(',')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents)) throw new Error('Valor monetário muito alto')
  return cents
}

export function parsePercentBR(value: string): number {
  const raw = value.trim()
  if (!/^(?:\d{1,3})(?:,\d{1,2})?$/.test(raw)) throw new Error('Percentual inválido')
  const [whole, fraction = ''] = raw.split(',')
  const bps = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (bps > 10000) throw new Error('Percentual acima de 100%')
  return bps
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}
