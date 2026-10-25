export type PremiumSearchOption = {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')

export function searchPremiumOptions<T extends PremiumSearchOption>(
  options: readonly T[],
  query: string
): T[] {
  const tokens = normalize(query).trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return [...options]

  return options.filter(option => {
    const haystack = normalize(
      `${option.label} ${option.description ?? ''}`
    )
    return tokens.every(token => haystack.includes(token))
  })
}

export function validPremiumMoneyDigits(raw: string): boolean {
  return /^\d{1,15}$/.test(raw)
}
