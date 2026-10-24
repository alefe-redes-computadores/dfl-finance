import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path='src/app/(app)/transactions/page.tsx'
const source=fs.readFileSync(path,'utf8')
let total=0
function test(name,fn){
  fn()
  total++
  console.log('✓',name)
}

test('TSX valido',()=>{
  const parsed=ts.createSourceFile(
    path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
  )
  assert.equal(parsed.parseDiagnostics.length,0)
})

const a=source.indexOf('const pendingSummaryTxs = useMemo(')
const b=source.indexOf('const pendingTxs = filtered.filter(',a)
test('Memoizacao localizada',()=>{
  assert.ok(a>=0&&b>a)
})
const region=source.slice(a,b)

test('Consulta original preservada',()=>{
  assert.ok(region.includes('transactionsWithJoin.filter('))
})
test('Data inicial considerada',()=>{
  assert.ok(region.includes('startMonth,'))
})
test('Data final considerada',()=>{
  assert.ok(region.includes('endMonth,'))
})
test('Hoje considerado',()=>{
  assert.ok(region.includes('todayIso,'))
})
test('Status considerado',()=>{
  assert.ok(region.includes('advFilters.status,'))
})
test('Conta considerada',()=>{
  assert.ok(region.includes('advFilters.accountId,'))
})
test('Categoria considerada',()=>{
  assert.ok(region.includes('effectiveCategoryFilter,'))
})
test('Busca diferida considerada',()=>{
  assert.ok(region.includes('deferredSearch,'))
})
test('Observacoes consideradas',()=>{
  assert.ok(region.includes('advFilters.searchNotes,'))
})
test('Valores considerados',()=>{
  assert.ok(region.includes('advFilters.minAmount,'))
  assert.ok(region.includes('advFilters.maxAmount,'))
})
test('Pendencias continuam limitadas ao dia',()=>{
  assert.ok(region.includes('tx.date > todayIso'))
})
test('Transferencias preservadas',()=>{
  assert.ok(source.includes('transfer_group_id'))
})
test('Agrupamento V189 preservado',()=>{
  assert.ok(source.includes('const grouped = useMemo('))
})
test('Busca V188 preservada',()=>{
  assert.ok(source.includes('useDeferredValue(search)'))
})
test('Gate Android instalado',()=>{
  assert.ok(fs.readFileSync(
    '.github/workflows/android-build.yml','utf8'
  ).includes('node scripts/check-v190-pending-performance.mjs'))
})
console.log(`V190: ${total} contratos aprovados.`)
