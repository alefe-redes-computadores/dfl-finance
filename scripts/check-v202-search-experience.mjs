import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const p='src/app/(app)/transactions/page.tsx'
const s=fs.readFileSync(p,'utf8')
const flow=fs.readFileSync('.github/workflows/android-build.yml','utf8')
let total=0

function test(name,condition) {
  assert.ok(condition,name)
  total++
  console.log('✓',name)
}

const ast=ts.createSourceFile(
  p,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)

test('TSX valido',ast.parseDiagnostics.length===0)
test('Input controlado',s.includes('value={search}'))
test('Busca diferida preservada',s.includes('useDeferredValue(search)'))
test('Input identificado',s.includes('aria-label="Buscar transações por nome ou categoria"'))
test('Input associado ao status',s.includes('aria-describedby="transaction-search-status"'))
test('Status presente',s.includes('id="transaction-search-status"'))
test('Leitor de tela informado',s.includes('aria-live="polite"'))
test('Estado de atualizacao',s.includes('searchUpdating ? ('))
test('Indicador de progresso',s.includes('Atualizando resultados'))
test('Contador de lancamentos',s.includes('displayTxs.length} lançamento(s)'))
test('Contador de recebiveis',s.includes('visibleDebtReceivables.length} valor(es) a receber'))
test("Busca pode ser limpa",s.includes("setSearch(\u0027\u0027)"))
test('Filtro de contas preservado',s.includes('advFilters.accountId'))
test('Filtro de categorias preservado',s.includes('effectiveCategoryFilter'))
test('Agrupamento por data preservado',s.includes('const grouped = useMemo('))
test('Totais financeiros preservados',s.includes('const pendingTotals = useMemo('))
test('Transferencias preservadas',s.includes('transfer_group_id'))
test('Exportacao preservada',s.includes('exportTransactionsToCSV'))
test('Workflow inclui V202',flow.includes('node scripts/check-v202-search-experience.mjs'))

console.log(`V202: ${total} contratos aprovados.`)
