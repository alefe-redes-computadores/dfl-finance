import { parseMoneyBR, parsePercentBR } from './commercialSettlement'
import { parseSignedMoney, validateDate, type SaleRow, type Receipt } from './commercialBatch'

export type TablePreview = { headers: string[]; rows: string[][]; delimiter: string }
export type SaleMapping = { reference: string; date: string; gross: string; commission?: string; processing?: string; fixed?: string; retention?: string; adjustments?: string }
export type ReceiptMapping = { reference: string; date: string; amount: string }

// RFC 4180-style quoting, including embedded separators and newlines.
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [], row: string[] = []
  let field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else if (quoted) quoted = false
      else if (field === '') quoted = true
      else throw Error('Aspas fora do início do campo')
    } else if (ch === delimiter && !quoted) { row.push(field); field = '' }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(cell => cell.trim())) rows.push([...row])
      row.length = 0
    } else field += ch
  }
  if (quoted) throw Error('CSV com aspas não fechadas')
  row.push(field)
  if (row.some(cell => cell.trim())) rows.push(row)
  return rows
}
export function parseCsv(text: string): TablePreview {
  if (text.length > 2_000_000) throw Error('Arquivo acima do limite de 2 MB')
  const clean = text.replace(/^\uFEFF/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0]
  const delimiter = [';', ',', '\t'].sort((a,b) => firstLine.split(b).length - firstLine.split(a).length)[0]
  const data = parseDelimited(clean, delimiter)
  if (data.length < 2) throw Error('CSV precisa de cabeçalho e registros')
  if (data.length > 5001) throw Error('Limite de 5.000 registros por prévia')
  const headers = data[0].map(x => x.trim())
  if (headers.some(x => !x) || new Set(headers).size !== headers.length) throw Error('Cabeçalhos vazios ou repetidos')
  if (data.some(row => row.length !== headers.length)) throw Error('CSV possui linhas com número diferente de colunas')
  return { headers, rows: data.slice(1), delimiter }
}
function cell(row: string[], headers: string[], key: string | undefined, fallback = ''): string {
  if (!key) return fallback
  const i = headers.indexOf(key)
  if (i < 0) throw Error('Coluna não encontrada: ' + key)
  return row[i].trim()
}
export function mapSales(table: TablePreview, mapping: SaleMapping): SaleRow[] {
  return table.rows.map((row, i) => {
    try {
      return {
        reference: cell(row, table.headers, mapping.reference),
        date: validateDate(cell(row, table.headers, mapping.date)),
        grossCents: parseMoneyBR(cell(row, table.headers, mapping.gross)),
        commissionBps: parsePercentBR(cell(row, table.headers, mapping.commission, '0')),
        processingBps: parsePercentBR(cell(row, table.headers, mapping.processing, '0')),
        fixedFeeCents: parseMoneyBR(cell(row, table.headers, mapping.fixed, '0')),
        retentionCents: parseMoneyBR(cell(row, table.headers, mapping.retention, '0')),
        adjustmentsCents: parseSignedMoney(cell(row, table.headers, mapping.adjustments, '0'))
      }
    } catch (error) { throw Error(`Linha ${i + 2}: ${error instanceof Error ? error.message : 'inválida'}`) }
  })
}
export function mapReceipts(table: TablePreview, mapping: ReceiptMapping): Receipt[] {
  return table.rows.map((row, i) => {
    try { return { reference: cell(row, table.headers, mapping.reference), date: validateDate(cell(row, table.headers, mapping.date)), amountCents: parseMoneyBR(cell(row, table.headers, mapping.amount)) } }
    catch (error) { throw Error(`Linha ${i + 2}: ${error instanceof Error ? error.message : 'inválida'}`) }
  })
}
