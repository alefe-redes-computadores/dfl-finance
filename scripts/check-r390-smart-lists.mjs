import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const paths={
  accounts:'src/app/(app)/accounts/page.tsx',
  cards:'src/app/(app)/cards/page.tsx',
  helper:'src/lib/financialSearchNormalization.ts'
}

const source=Object.fromEntries(
  Object.entries(paths).map(([key,path])=>
    [key,fs.readFileSync(path,'utf8')]
  )
)

const checks=[
  ['Contas usam normalizador comum',
    source.accounts.includes('normalizeFinancialSearch(search)')],
  ['Nomes e instituicoes normalizados',
    source.accounts.includes('normalizeFinancialSearch(value).includes(term)')],
  ['Filtro por tipo preservado',
    source.accounts.includes('accountFilter')],
  ['Ordenacao manual preservada',
    source.accounts.includes("accountSort === 'manual'")],
  ['Ordenacao por saldo preservada',
    source.accounts.includes("accountSort === 'balance'")],
  ['Exclusao segura preservada',
    source.accounts.includes('safeDelete')],
  ['Cartoes iniciam com 12 resultados',
    source.cards.includes('useState(12)')],
  ['Cartoes renderizados progressivamente',
    source.cards.includes('sortedCards.slice(0, visibleCardLimit)')],
  ['Carregar mais cartoes',
    source.cards.includes('setVisibleCardLimit(current => current + 12)')],
  ['Ordem personalizada preservada',
    source.cards.includes('cardOrder.indexOf')],
  ['Faturas preservadas',
    source.cards.includes('credit_invoices')],
  ['Navegacao para detalhes preservada',
    source.cards.includes('/cards/details?id=')],
  ['Normalizador nao altera dados',
    !source.helper.includes('db.transactions.update')]
]

for(const [name,passed] of checks){
  assert.ok(passed,name)
  console.log('OK:',name)
}

for(const path of Object.values(paths)){
  const sf=ts.createSourceFile(
    path,
    fs.readFileSync(path,'utf8'),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith('.tsx')?
      ts.ScriptKind.TSX:ts.ScriptKind.TS
  );

  assert.equal(sf.parseDiagnostics.length,0,
    'Sintaxe invalida: '+path);
}

console.log('R390: contratos aprovados')
