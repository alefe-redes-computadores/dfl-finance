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
