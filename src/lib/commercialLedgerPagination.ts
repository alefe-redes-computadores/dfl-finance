/** R462 — leitura integral com paginação por chave, duplicatas e contagem final. */
export const COMMERCIAL_PAGE_SIZE = 200
export const COMMERCIAL_MAX_ROWS = 50000

export interface CommercialPage<T> {
  data: T[] | null
  count: number | null
  error?: { message: string } | null
}

export async function fetchCompleteCommercialRows<T extends { id: string }>(
  fetchPage: (afterId: string | null, size: number) => Promise<CommercialPage<T>>,
  fetchFinalCount: () => Promise<{ count: number | null; error?: { message: string } | null }>,
  pageSize = COMMERCIAL_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error('Tamanho de página comercial inválido.')
  }
  const rows: T[] = []
  const ids = new Set<string>()
  let cursor: string | null = null
  let expected: number | null = null
  for (;;) {
    const result = await fetchPage(cursor, pageSize)
    if (result.error) throw new Error(`Consulta comercial falhou: ${result.error.message}`)
    if (!Array.isArray(result.data) || result.data.length > pageSize) {
      throw new Error('Página comercial inválida: totais indisponíveis.')
    }
    if (expected === null) {
      if (!Number.isSafeInteger(result.count) || result.count === null || result.count < 0) {
        throw new Error('Contagem comercial indisponível: totais bloqueados.')
      }
      expected = result.count
      if (expected > COMMERCIAL_MAX_ROWS) {
        throw new Error('Volume comercial excede limite seguro do dispositivo. Totais bloqueados; usar agregação no servidor.')
      }
    }
    for (const row of result.data) {
      if (typeof row?.id !== 'string' || !row.id || ids.has(row.id) || (cursor !== null && row.id <= cursor)) {
        throw new Error('Registros comerciais duplicados ou fora de ordem: totais bloqueados.')
      }
      ids.add(row.id)
      rows.push(row)
    }
    if (rows.length > expected) throw new Error('Dados mudaram durante a consulta: atualize o ledger.')
    if (result.data.length < pageSize) break
    cursor = result.data[result.data.length - 1].id
  }
  const final = await fetchFinalCount()
  if (final.error || final.count !== expected || rows.length !== expected) {
    throw new Error('Quantidade de registros mudou ou leitura foi incompleta. Totais bloqueados; atualize.')
  }
  return rows
}
