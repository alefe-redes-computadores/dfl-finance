import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path = 'src/app/(app)/transactions/page.tsx'
const source = fs.readFileSync(path, 'utf8')
const workflow = fs.readFileSync(
  '.github/workflows/android-build.yml', 'utf8'
)

let count = 0

function check(name, fn) {
  fn()
  count++
  console.log('✓', name)
}

check('Sintaxe TSX valida', () => {
  const parsed = ts.createSourceFile(
    path, source,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
  )
  assert.equal(parsed.parseDiagnostics.length, 0)
})

check('Agrupamento usa memoizacao', () => {
  assert.ok(source.includes('const grouped = useMemo('))
  assert.ok(source.includes('() => groupByDate(displayTxs)'))
  assert.ok(source.includes('[displayTxs]'))
})

check('Datas ordenadas usam memoizacao', () => {
  assert.ok(source.includes('const sortedDates = useMemo('))
  assert.ok(source.includes('[grouped, advFilters.sortOrder]'))
})

check('Ordenacao crescente preservada', () => {
  assert.ok(source.includes("advFilters.sortOrder === 'desc'"))
  assert.ok(source.includes('a.localeCompare(b)'))
})

check('Ordenacao decrescente preservada', () => {
  assert.ok(source.includes('b.localeCompare(a)'))
})

check('Agrupamento continua por data', () => {
  assert.ok(source.includes("const key = t.date || 'Sem Data'"))
  assert.ok(source.includes('groups[key].push(t)'))
})

check('Renderizacao utiliza grupos corretos', () => {
  assert.ok(source.includes('grouped[date].map('))
})

check('Chave de transacao continua unica', () => {
  assert.ok(source.includes('key={t.id}'))
})

check('Transferencias preservadas', () => {
  assert.ok(source.includes('transfer_group_id'))
  assert.ok(source.includes('const displayTxs = useMemo('))
})

check('Busca diferida V188 preservada', () => {
  assert.ok(source.includes('useDeferredValue(search)'))
  assert.ok(source.includes('const normalizedSearch = normalizeFinancialSearch(deferredSearch)'))
})

check('Campo de busca imediato preservado', () => {
  assert.ok(source.includes('value={search}'))
})

check('Filtros avancados preservados', () => {
  for (const value of [
    'advFilters.accountId',
    'advFilters.status',
    'advFilters.minAmount',
    'advFilters.maxAmount',
    'effectiveCategoryFilter'
  ]) {
    assert.ok(source.includes(value))
  }
})

check('Exportacao CSV preservada', () => {
  assert.ok(source.includes('exportTransactionsToCSV'))
})

check('Reparo de lancamentos futuros preservado', () => {
  assert.ok(source.includes('repairFutureScheduledTransactions'))
})

check('Hook de sincronizacao preservado', () => {
  assert.ok(source.includes('useLocalSync'))
})

check('Android exige gate V189', () => {
  assert.ok(workflow.includes(
    'node scripts/check-v189-transaction-groups.mjs'
  ))
})

console.log(`V189: ${count} contratos aprovados.`)
