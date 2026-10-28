import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const helper='src/lib/financialSearchNormalization.ts'
const agenda='src/app/(app)/agenda/page.tsx'
const planning='src/app/(app)/planning/page.tsx'

const source=fs.readFileSync(helper,'utf8')

const output=ts.transpileModule(source,{
  fileName:helper,
  compilerOptions:{
    module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2022
  }
}).outputText

const module={exports:{}}
new Function('module','exports',output)(
  module,module.exports
)

const {
  normalizeFinancialSearch,
  matchesFinancialSearch
}=module.exports

const cases=[
  ['Fatura Nubank Outubro','nubank outubro',true],
  ['Fatura Nubank Outubro','outubro nubank',true],
  ['Farmácia Central','farmacia central',true],
  ['Mercado São José','sao mercado',true],
  ['Pagamento de energia','internet',false],
  ['Compra no cartão','  CARTAO   compra  ',true],
  ['','',true],
  ['', 'pendencia',false]
]

for(const [content,query,expected] of cases){
  assert.equal(
    matchesFinancialSearch(content,query),
    expected,
    `${content} / ${query}`
  )
}

assert.equal(
  normalizeFinancialSearch('  CRÉDITO   PESSOAL  '),
  'credito pessoal'
)

for(const path of [helper,agenda,planning]){
  const text=fs.readFileSync(path,'utf8')
  const ast=ts.createSourceFile(
    path,text,ts.ScriptTarget.Latest,true,
    path.endsWith('.tsx')
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS
  )

  assert.equal(ast.parseDiagnostics.length,0,path)
}

const agendaSource=fs.readFileSync(agenda,'utf8')
const planningSource=fs.readFileSync(planning,'utf8')

assert(
  agendaSource.includes('matchesFinancialSearch(')
)
assert(
  planningSource.includes('normalizeFinancialSearch(categorySearch)')
)
assert(agendaSource.includes('buildFinanceAgenda'))
assert(planningSource.includes('buildFinancePlanning'))

console.log('R391: busca composta e contratos aprovados')
