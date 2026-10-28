// V185 — Identidades estáveis para dados locais.
// Sem acesso ao banco, rede ou ledger.

const EMPTY_ROWS: never[] = Object.freeze([]) as unknown as never[]

export function stableLocalRows<T>(data: T[] | undefined): T[] {
  return data === undefined ? EMPTY_ROWS as T[] : data
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue)
  }

  if (value && typeof value === 'object') {
    if (value instanceof Date) {
      return value.toISOString()
    }

    const source = value as Record<string, unknown>
    const normalized: Record<string, unknown> = {}

    for (const key of Object.keys(source).sort()) {
      const item = source[key]

      if (item !== undefined) {
        normalized[key] = stableValue(item)
      }
    }

    return normalized
  }

  return value
}

export function localFilterSignature(
  filters?: Record<string, unknown>
): string {
  return JSON.stringify(stableValue(filters || {}))
}

/**
 * R396 — evita ordenar novamente resultados que já estão
 * monotonicamente ordenados.
 *
 * Mantém exatamente o mesmo comparador e o mesmo array,
 * sem produzir operações no banco ou efeitos externos.
 *
 * O método pode ordenar o array recebido quando necessário.
 * Use somente com arrays locais de consulta, nunca com
 * coleções compartilhadas ou congeladas.
 */
export function sortLocalRowsIfNeeded<T>(
  rows: T[],
  compare: (a: T, b: T) => number
): T[] {
  if (rows.length < 2) return rows

  for (let i = 1; i < rows.length; i++) {
    if (compare(rows[i - 1], rows[i]) > 0) {
      return rows.sort(compare)
    }
  }

  return rows
}
