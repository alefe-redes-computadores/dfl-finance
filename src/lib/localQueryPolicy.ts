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
