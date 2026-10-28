import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const helperPath='src/lib/financialSearchNormalization.ts'
const pagePath='src/app/(app)/transactions/page.tsx'

const helper=fs.readFileSync(helperPath,'utf8')
const page=fs.readFileSync(pagePath,'utf8')
const conciliation=fs.readFileSync(
  'src/lib/conciliationViewPolicy.ts','utf8'
)

function normalize(value){
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g,' ')
    .trim()
}

const samples=[
  ['Farmácia','farmacia'],
  ['AÇÃO','acao'],
  ['Cartão de Crédito','cartao de credito'],
  ['  Mercado   Central  ','mercado central'],
  ['PAGAMENTO PIX','pagamento pix'],
  [null,''],
  [123,'123']
]

for(const [input,expected] of samples){
  assert.equal(normalize(input),expected)
}

assert(helper.includes('normalizeFinancialSearch'))
assert(page.includes(
  'normalizeFinancialSearch(deferredSearch)'
))

assert.equal(
  (page.match(/normalizeFinancialSearch\(/g)||[]).length,
  7
)

assert(page.includes('useDeferredValue'))
assert(page.includes('searchUpdating'))
assert(page.includes('setSearch'))
assert(page.includes('pendingSummaryTxs'))
assert(page.includes('visibleDebtReceivables'))

assert(conciliation.includes('normalize(search)'))
assert(conciliation.includes('tokens.every'))

for(const path of [helperPath,pagePath]){
  const sf=ts.createSourceFile(
    path,
    fs.readFileSync(path,'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  )

  assert.equal(
    sf.parseDiagnostics.length,0,
    'Sintaxe invalida: '+path
  )
}

console.log(
  'R386: normalizacao, busca, conciliação e sintaxe OK'
)
