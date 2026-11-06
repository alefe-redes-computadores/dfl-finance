/** CNPJ R454 — suporte a identificadores numéricos e alfanuméricos (RFB 2026).
 * Só valida a estrutura/dígitos: não confirma situação cadastral na Receita.
 */
export function cleanCnpj(value: string): string {
  const data = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return data.slice(0, 12) + data.slice(12).replace(/[^0-9]/g, '').slice(0, 2)
}

export function formatCnpj(value: string): string {
  const raw = cleanCnpj(value)
  const length = raw.length
  if (!length) return ''
  return raw.slice(0, 2) +
    (length > 2 ? '.' + raw.slice(2, 5) : '') +
    (length > 5 ? '.' + raw.slice(5, 8) : '') +
    (length > 8 ? '/' + raw.slice(8, 12) : '') +
    (length > 12 ? '-' + raw.slice(12, 14) : '')
}

const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] as const

function checkDigit(base: string, weights: readonly number[]): number {
  const sum = weights.reduce((total, weight, index) =>
    total + (base.charCodeAt(index) - 48) * weight, 0)
  const remainder = sum % 11
  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCnpj(value: string): boolean {
  const cleaned = cleanCnpj(value)
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cleaned)) return false
  if (/^(\d)\1{13}$/.test(cleaned)) return false
  const digitOne = checkDigit(cleaned.slice(0, 12), FIRST_WEIGHTS)
  const digitTwo = checkDigit(cleaned.slice(0, 12) + digitOne, SECOND_WEIGHTS)
  return cleaned.slice(12) === `${digitOne}${digitTwo}`
}
