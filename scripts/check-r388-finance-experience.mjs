import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const paths={
  home:'src/app/(app)/home/page.tsx',
  inbox:'src/app/(app)/conciliation/page.tsx',
  transactions:'src/app/(app)/transactions/page.tsx'
}

const read=p=>fs.readFileSync(p,'utf8')

const home=read(paths.home)
const inbox=read(paths.inbox)
const transactions=read(paths.transactions)

const checks=[
  ['Home conta prioridades visiveis',
    home.includes('{visiblePriorityAlerts.length}')],
  ['Home preserva privacidade',
    home.includes('hideBalance')],
  ['Home preserva disponibilidade',
    home.includes('operationalAvailable')],
  ['Home preserva compromissos',
    home.includes('resolveKnownCommitments')],
  ['Home preserva Inbox',
    home.includes('homeInboxSummary')],
  ['Home comunica prioridades',
    home.includes('prioridades visíveis')],
  ['Conciliação preserva politica',
    inbox.includes('filterConciliationView')],
  ['Conciliação preserva ordenacao',
    inbox.includes('sortConciliationView')],
  ['Conciliação comunica resultados',
    inbox.includes('pendências exibidas')],
  ['Conciliação preserva contexto',
    inbox.includes('effectiveContext')],
  ['Conciliação preserva revisao',
    inbox.includes('openReview')],
  ['Conciliação preserva conclusao',
    inbox.includes('conciliate(tx)')],
  ['Busca de transações diferida',
    transactions.includes('useDeferredValue(search)')],
  ['Busca sem acentos',
    transactions.includes('normalizeFinancialSearch(deferredSearch)')],
  ['Campo de busca imediato',
    transactions.includes('value={search}')],
  ['Filtros avançados preservados',
    transactions.includes('applyAdvancedFilters')],
  ['Transferências preservadas',
    transactions.includes('transfer_group_id')],
]

let count=0

for(const [name,ok] of checks){
  assert.ok(ok,name)
  console.log('OK:',name)
  count++
}

for(const path of Object.values(paths)){
  const sf=ts.createSourceFile(
    path,read(path),
    ts.ScriptTarget.Latest,
    true,ts.ScriptKind.TSX
  )
  assert.equal(
    sf.parseDiagnostics.length,0,
    'Erro TSX em '+path
  )
  count++
}

console.log(`R388: ${count} contratos aprovados`)
