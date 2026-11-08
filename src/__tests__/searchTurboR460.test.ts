import { collectSmartSearchSuggestions, normalizeSmartLookup } from '@/lib/smartSearchTurbo'
describe('R460 — autocomplete financeiro seguro', () => {
  const rows = [
    {description:'Mercêaria Silvana',type:'expense',date:'2026-11-02',amount:32,category_id:'a'},
    {description:'Mercearia Silvana',type:'expense',date:'2026-11-07',amount:49,category_id:'b'},
    {description:'Salário',type:'income',date:'2026-11-05',amount:3200},
    {description:'Pagamento aluguel',type:'expense',date:'2026-11-06',amount:900},
    {description:'Silvana transferiu',type:'transfer',date:'2026-11-03',amount:50},
  ]
  test('acentos, espaços e caixa normalizados', () => {
    expect(normalizeSmartLookup('  MERCÊARIA   SílVaNa ')).toBe('mercearia silvana')
  })
  test('agrega descrições equivalentes e prioriza a última ocorrência', () => {
    const found = collectSmartSearchSuggestions(rows, 'meRCEaria', 'expense')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({count:2,amount:49,category_id:'b'})
  })
  test('filtro por tipo mantém transferências fora de despesa', () => {
    const found = collectSmartSearchSuggestions(rows, 'silvana', 'expense')
    expect(found).toHaveLength(1)
    expect(found[0].type).toBe('expense')
  })
  test('busca geral preserva transferências e texto de nomes', () => {
    expect(collectSmartSearchSuggestions(rows, 'silvana').length).toBe(2)
  })
  test('não tenta trabalhar com pesquisa vazia/curta', () => {
    expect(collectSmartSearchSuggestions(rows,'s')).toEqual([])
    expect(collectSmartSearchSuggestions(rows,'')).toEqual([])
  })
  test('limite máximo respeitado', () => {
    expect(collectSmartSearchSuggestions(rows, 'a', undefined, 1)).toEqual([])
    expect(collectSmartSearchSuggestions(rows, 'si', undefined, 1)).toHaveLength(1)
  })
})
