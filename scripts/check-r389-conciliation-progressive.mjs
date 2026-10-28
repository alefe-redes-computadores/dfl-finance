import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path='src/app/(app)/conciliation/page.tsx'
const source=fs.readFileSync(path,'utf8')

const checks=[
  ['Lote inicial de 30',source.includes('useState(30)')],
  ['Renderizacao progressiva',
    source.includes('displayed.slice(0, visibleLimit)')],
  ['Contagem de restantes',
    source.includes('displayed.length - renderedPendings.length')],
  ['Proximo lote',
    source.includes('setVisibleLimit(current => current + 30)')],
  ['Reset de lote',
    source.includes('setVisibleLimit(30)')],
  ['Pesquisa reseta lote',
    source.includes('[filter, search, direction, sortMode, effectiveContext]')],
  ['Filtros antes da paginacao',
    source.includes('filterConciliationView(visible, direction, search)')],
  ['Ordenacao antes da paginacao',
    source.includes('sortConciliationView(')],
  ['Revisao preservada',
    source.includes('openReview(tx)')],
  ['Conciliacao preservada',
    source.includes('conciliate(tx)')],
  ['Futuro protegido',
    source.includes('inboxState(tx, today).future')],
  ['Vencimento obrigatorio',
    source.includes('!pendingDueDate(tx)')],
  ['Limpar filtros',
    source.includes('Limpar filtros e ver pendências')],
  ['Contexto preservado',
    source.includes('effectiveContext')],
]

for(const [name,passed] of checks){
  assert.ok(passed,name)
  console.log('OK:',name)
}

const ast=ts.createSourceFile(
  path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)

assert.equal(ast.parseDiagnostics.length,0)

console.log(`R389: ${checks.length+1} contratos aprovados`)
