import fs from 'node:fs'

const page = fs.readFileSync('src/app/(app)/search/page.tsx', 'utf8')

const checks = [
  ['botão de filtros compacto', page.includes('aria-label="Filtrar busca"') && page.includes('<SlidersHorizontal')],
  ['badge de filtros ativos', page.includes('{activeFilters.length}') && page.includes('absolute -right-1.5 -top-1.5')],
  ['bottom sheet premium', page.includes('Onde buscar?') && page.includes('rounded-t-[30px]')],
  ['filtros múltiplos', page.includes('toggleFilter') && page.includes('[...current, filter]')],
  ['receita separada', page.includes("{ id: 'income', label: 'Receitas'")],
  ['despesa separada', page.includes("{ id: 'expense', label: 'Despesas'")],
  ['transferência separada', page.includes("{ id: 'transfer', label: 'Transferências'")],
  ['quem me deve separado', page.includes("{ id: 'debt', label: 'Quem me deve'")],
  ['empréstimos separados', page.includes("{ id: 'loan', label: 'Empréstimos'")],
  ['financiamentos separados', page.includes("{ id: 'financing', label: 'Financiamentos'")],
  ['assinaturas separadas', page.includes("{ id: 'subscription', label: 'Assinaturas'")],
  ['resultado respeita filtro', page.includes('visibleItems.map((item)') && page.includes('selected.has(filter)')],
  ['filtro ativo resumido', page.includes('activeFilterLabels') && page.includes('Limpar')],
]

let failed = 0
for (const [name, ok] of checks) {
  console.log(`${ok ? 'OK ' : 'ERR'} ${name}`)
  if (!ok) failed += 1
}
if (failed) process.exit(1)
console.log('\nV62B filtros premium: OK')
