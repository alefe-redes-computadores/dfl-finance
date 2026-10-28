/**
 * Normalizacao exclusiva para pesquisa.
 *
 * Nunca modifica descricoes gravadas, valores,
 * categorias ou registros financeiros.
 */
export function normalizeFinancialSearch(
  value: unknown
): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pesquisa composta: todas as palavras devem existir
 * no conteúdo, independentemente da ordem.
 *
 * Somente leitura. Não modifica dados armazenados.
 */
export function matchesFinancialSearch(
  content: unknown,
  query: unknown
): boolean {
  const normalizedContent = normalizeFinancialSearch(content)
  const tokens = normalizeFinancialSearch(query)
    .split(' ')
    .filter(Boolean)

  return tokens.every(token =>
    normalizedContent.includes(token)
  )
}
