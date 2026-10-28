import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const p='src/app/(app)/transactions/page.tsx'
const s=fs.readFileSync(p,'utf8')
const flow=fs.readFileSync('.github/workflows/android-build.yml','utf8')
let n=0

function test(name,condition) {
  assert.ok(condition,name)
  n++
  console.log('✓',name)
}

const ast=ts.createSourceFile(
  p,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)

test('TSX valido',ast.parseDiagnostics.length===0)
test('Grupos protegidos',s.includes('Object.create(null)'))
test('Agrupamento preserva registros',s.includes('groups[key].push(t)'))
test('Normalizacao unica',s.includes('const normalizedSearch = normalizeFinancialSearch(deferredSearch)'))
test('Filtro principal reutiliza termo',s.includes('const term = normalizedSearch'))
test('V188: busca diferida continua ativa',s.includes('useDeferredValue(search)'))
test('V188: entrada imediata preservada',s.includes('value={search}'))
test('V188: busca de dividas preservada',s.includes('const debtSearchTerm = normalizedSearch.trim()'))
test('V188: observacoes opcionais preservadas',s.includes('advFilters.searchNotes'))
test('V188: categoria continua pesquisavel',s.includes('t.categories?.name'))
test('V188: descricao continua pesquisavel',s.includes('t.description'))

test('Duas buscas compartilham termo',s.split('const term = normalizedSearch').length-1===2)
test('Memoizacao principal depende do termo',s.includes('normalizedSearch,\n      todayIso'))
test('Resumo depende do termo',s.includes('normalizedSearch,\n    ]\n  )'))
test('Busca de dividas preservada',s.includes('const debtSearchTerm = normalizedSearch.trim()'))
test('Input continua instantaneo',s.includes('value={search}'))
test('Atualizacao possui estado acessivel',s.includes('aria-busy={searchUpdating}'))
test('Grupos usam content visibility',s.includes('[content-visibility:auto]'))
test('Reserva de altura existe',s.includes('[contain-intrinsic-size:auto_180px]'))
test('Pendencias memoizadas',s.includes('const pendingSummaryTxs = useMemo('))
test('Totais protegidos',s.includes('const pendingTotals = useMemo('))
test('Cards memoizados',s.includes('React.memo(TransactionItem)'))
test('Datas memoizadas',s.includes('const dateLabels = useMemo('))
test('Transferencias preservadas',s.includes('transfer_group_id'))
test('Busca em observacoes preservada',s.includes('advFilters.searchNotes'))
test('Filtros por valor preservados',s.includes('advFilters.minAmount')&&s.includes('advFilters.maxAmount'))
test('Filtros por conta preservados',s.includes('advFilters.accountId'))
test('Exportacao CSV preservada',s.includes('exportTransactionsToCSV'))
test('Gate Android V195 presente',flow.includes('node scripts/check-v195-transaction-performance.mjs'))

console.log(`V195: ${n} contratos aprovados.`)
