import { calculateSettlement, parseMoneyBR, type SettlementResult } from './commercialSettlement'

export type SaleRow = { reference: string; date: string; grossCents: number; commissionBps: number; processingBps: number; fixedFeeCents: number; retentionCents: number; adjustmentsCents: number }
export type SaleResult = SaleRow & { settlement: SettlementResult }
export type Match = { saleReferences: string[]; receiptReferences: string[]; differenceCents: number; status: 'matched' | 'partial' | 'overpaid' }
export type Receipt = { reference: string; date: string; amountCents: number }

function safeAmount(value: number): number { if (!Number.isSafeInteger(value) || value < 0) throw Error('Valor inválido'); return value }
export function parseSignedMoney(value: string): number {
  const t = value.trim()
  return t.startsWith('-') ? -parseMoneyBR(t.slice(1)) : parseMoneyBR(t.replace(/^\+/, ''))
}
export function validateDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Data deve ser AAAA-MM-DD')
  const date = new Date(value + 'T00:00:00Z')
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Error('Data inválida')
  return value
}
export function normalizeSales(rows: SaleRow[]): SaleResult[] {
  const seen = new Set<string>()
  return rows.map(row => {
    const reference = row.reference.trim()
    if (!reference || reference.length > 120) throw Error('Referência inválida')
    if (seen.has(reference)) throw Error('Venda duplicada: ' + reference)
    seen.add(reference)
    validateDate(row.date)
    return { ...row, reference, settlement: calculateSettlement(row) }
  })
}
export function normalizeReceipts(rows: Receipt[]): Receipt[] {
  const seen = new Set<string>()
  return rows.map(row => {
    const reference = row.reference.trim()
    if (!reference || reference.length > 120 || seen.has(reference)) throw Error('Repasse duplicado ou inválido: ' + reference)
    seen.add(reference)
    validateDate(row.date)
    safeAmount(row.amountCents)
    return { ...row, reference }
  })
}
export function reconcile(sales: SaleResult[], receipts: Receipt[], saleRefs: string[], receiptRefs: string[], toleranceCents = 0): Match {
  if (!Number.isSafeInteger(toleranceCents) || toleranceCents < 0) throw Error('Tolerância inválida')
  if (!saleRefs.length || !receiptRefs.length) throw Error('Selecione vendas e repasses')
  if (new Set(saleRefs).size !== saleRefs.length || new Set(receiptRefs).size !== receiptRefs.length) throw Error('Referências repetidas')
  const salesMap = new Map(sales.map(s => [s.reference, s]))
  const receiptMap = new Map(receipts.map(r => [r.reference, r]))
  let due = 0, received = 0
  for (const ref of saleRefs) { const sale = salesMap.get(ref); if (!sale) throw Error('Venda desconhecida'); due += sale.settlement.payableCents }
  for (const ref of receiptRefs) { const receipt = receiptMap.get(ref); if (!receipt) throw Error('Repasse desconhecido'); received += receipt.amountCents }
  if (!Number.isSafeInteger(due) || !Number.isSafeInteger(received)) throw Error('Total excede intervalo seguro')
  const differenceCents = received - due
  return { saleReferences: [...saleRefs], receiptReferences: [...receiptRefs], differenceCents, status: Math.abs(differenceCents) <= toleranceCents ? 'matched' : differenceCents < 0 ? 'partial' : 'overpaid' }
}
export function summary(sales: SaleResult[], receipts: Receipt[]) {
  const grossCents = sales.reduce((n, s) => n + s.grossCents, 0)
  const payableCents = sales.reduce((n, s) => n + s.settlement.payableCents, 0)
  const receivedCents = receipts.reduce((n, r) => n + r.amountCents, 0)
  if (![grossCents, payableCents, receivedCents].every(Number.isSafeInteger)) throw Error('Total excede intervalo seguro')
  return { grossCents, payableCents, receivedCents, differenceCents: receivedCents - payableCents }
}
