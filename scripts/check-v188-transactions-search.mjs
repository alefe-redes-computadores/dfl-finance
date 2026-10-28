import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path = 'src/app/(app)/transactions/page.tsx'
const source = fs.readFileSync(path, 'utf8')
const workflow = fs.readFileSync(
  '.github/workflows/android-build.yml',
  'utf8'
)

let count = 0

function check(name, fn) {
  fn()
  count++
  console.log('✓', name)
}

check('Sintaxe TSX valida', () => {
  const parsed = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  assert.equal(parsed.parseDiagnostics.length, 0)
})

check('React usa deferred value', () => {
  assert.ok(source.includes('useDeferredValue'))
  assert.ok(source.includes('useDeferredValue(search)'))
})

check('Campo de texto continua imediato', () => {
  assert.ok(source.includes('value={search}'))
  assert.ok(source.includes('setSearch(e.target.value)'))
})

check('Filtro principal usa busca diferida', () => {
  assert.ok(source.includes('if (deferredSearch)'))
  assert.ok(
    source.includes(
      'normalizeFinancialSearch(deferredSearch)'
    )
  )
  assert.ok(source.includes(
    "from '@/lib/financialSearchNormalization'"
  ))
})

check('Busca de dividas usa valor diferido', () => {
  assert.ok(source.includes(
    'const debtSearchTerm = normalizedSearch.trim()'
  ))
})

check('Busca não altera ledger', () => {
  assert.ok(!source.includes('db.transactions.update(deferredSearch'))
})

check('Filtro por periodo preservado', () => {
  assert.ok(source.includes('startMonth'))
  assert.ok(source.includes('endMonth'))
})

check('Filtro de status preservado', () => {
  assert.ok(source.includes('advFilters.status'))
})

check('Filtro de categoria preservado', () => {
  assert.ok(source.includes('effectiveCategoryFilter'))
})

check('Filtro por valor preservado', () => {
  assert.ok(source.includes('advFilters.minAmount'))
  assert.ok(source.includes('advFilters.maxAmount'))
})

check('Busca em observações preservada', () => {
  assert.ok(source.includes('advFilters.searchNotes'))
})

check('Transferências preservadas', () => {
  assert.ok(source.includes('transfer_group_id'))
})

check('Exportação CSV preservada', () => {
  assert.ok(source.includes('exportTransactionsToCSV'))
})

check('Reparo de lançamentos futuros preservado', () => {
  assert.ok(source.includes('repairFutureScheduledTransactions'))
})

check('Fluxo de sincronização preservado', () => {
  assert.ok(source.includes('useLocalSync'))
})

check('Android exige V188', () => {
  assert.ok(workflow.includes(
    'node scripts/check-v188-transactions-search.mjs'
  ))
})

console.log(`V188: ${count} contratos aprovados.`)
