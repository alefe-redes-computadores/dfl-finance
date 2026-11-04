import { normalizeSales, normalizeReceipts, reconcile, type SaleRow, type Receipt, type Match } from './commercialBatch'

export type CommercialSession = { version: 2; simulation: true; exportedAt: string; sales: SaleRow[]; receipts: Receipt[]; matches: Match[] }
const LIMIT = 5_000_000
function record(x: unknown): x is Record<string, unknown> { return x !== null && typeof x === 'object' && !Array.isArray(x) }
function str(x: unknown): x is string { return typeof x === 'string' }
function number(x: unknown): x is number { return typeof x === 'number' && Number.isSafeInteger(x) }
function sale(x: unknown): x is SaleRow { return record(x) && str(x.reference) && str(x.date) && ['grossCents','commissionBps','processingBps','fixedFeeCents','retentionCents','adjustmentsCents'].every(k => number(x[k])) }
function receipt(x: unknown): x is Receipt { return record(x) && str(x.reference) && str(x.date) && number(x.amountCents) }
function match(x: unknown): x is Match { return record(x) && Array.isArray(x.saleReferences) && x.saleReferences.every(str) && Array.isArray(x.receiptReferences) && x.receiptReferences.every(str) && number(x.differenceCents) && ['matched','partial','overpaid'].includes(String(x.status)) }
export function exportSession(sales: SaleRow[], receipts: Receipt[], matches: Match[]): string {
  const payload: CommercialSession = { version: 2, simulation: true, exportedAt: new Date().toISOString(), sales, receipts, matches }
  return JSON.stringify(payload, null, 2)
}
export function importSession(text: string): CommercialSession {
  if (text.length > LIMIT) throw Error('Sessão acima do limite de 5 MB')
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw Error('Arquivo JSON inválido') }
  if (!record(raw) || raw.version !== 2 || raw.simulation !== true || !str(raw.exportedAt) || !Array.isArray(raw.sales) || !Array.isArray(raw.receipts) || !Array.isArray(raw.matches)) throw Error('Formato de sessão incompatível')
  if (raw.sales.length > 5000 || raw.receipts.length > 5000 || raw.matches.length > 5000) throw Error('Sessão excede limite de registros')
  if (!raw.sales.every(sale) || !raw.receipts.every(receipt) || !raw.matches.every(match)) throw Error('Tipos de dados inválidos')
  const sales = normalizeSales(raw.sales)
  const receipts = normalizeReceipts(raw.receipts)
  const usedSales = new Set<string>(), usedReceipts = new Set<string>()
  for (const item of raw.matches) {
    const verified = reconcile(sales, receipts, item.saleReferences, item.receiptReferences)
    if (verified.differenceCents !== item.differenceCents || verified.status !== item.status) throw Error('Conciliação adulterada ou divergente')
    for (const ref of item.saleReferences) { if (usedSales.has(ref)) throw Error('Venda conciliada mais de uma vez'); usedSales.add(ref) }
    for (const ref of item.receiptReferences) { if (usedReceipts.has(ref)) throw Error('Repasse conciliado mais de uma vez'); usedReceipts.add(ref) }
  }
  return { version: 2, simulation: true, exportedAt: raw.exportedAt, sales: raw.sales, receipts: raw.receipts, matches: raw.matches }
}
