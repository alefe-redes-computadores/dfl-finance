// Apenas entrada de cenários. Não modifica dinheiro registrado.
export function parsePressureMoney(input: string): number | null {
  const raw = input.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!raw) return 0

  const formatBR = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/
  const formatDot = /^\d+(?:\.\d{1,2})?$/
  if (!formatBR.test(raw) && !formatDot.test(raw)) return null

  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0 || value > 100000000) {
    return null
  }
  return Math.round(value * 100) / 100
}
