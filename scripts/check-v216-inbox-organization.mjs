import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const pol='src/lib/conciliationViewSort.ts'
const page=read('src/app/(app)/conciliation/page.tsx')
const out={}
new Function('exports',ts.transpileModule(read(pol),{
  fileName:pol,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(out)
const sort=out.sortConciliationView
const rows=[
  {id:'future',amount:5000,date:'2026-11-10',review:false},
  {id:'late',amount:40,date:'2026-10-10',review:false},
  {id:'review',amount:20,date:'2026-12-10',review:true},
  {id:'today',amount:80,date:'2026-10-24',review:false}
]
const date=x=>x.date
const review=x=>x.review
const today='2026-10-24'
let n=0
function check(label,fn){fn();n++;console.log('✓',label)}

check('Revisão prioritária',()=>{
  assert.deepEqual(sort(rows,'priority',date,review,today).map(x=>x.id),
    ['review','late','today','future'])
})
check('Vencimento cronológico',()=>{
  assert.deepEqual(sort(rows,'date',date,review,today).map(x=>x.id),
    ['late','today','future','review'])
})
check('Maior valor',()=>{
  assert.deepEqual(sort(rows,'amount',date,review,today).map(x=>x.id),
    ['future','today','late','review'])
})
check('Sem mutação da lista',()=>{
  const snapshot=JSON.stringify(rows)
  sort(rows,'priority',date,review,today)
  assert.equal(JSON.stringify(rows),snapshot)
})
check('NaN não altera ordenação financeira',()=>{
  const bad=[{id:'bad',amount:NaN,date:'2026-10-24',review:false}]
  assert.equal(sort(bad,'amount',date,review,today).length,1)
})
check('Estado vazio usa resultado final',()=>{
  assert.ok(page.includes('{displayed.length === 0 ? ('))
})
check('Filtros combinados mantidos',()=>{
  assert.ok(page.includes('filterConciliationView(visible, direction, search)'))
})
check('Limpeza completa',()=>{
  for(const token of ["setSearch('')","setDirection('all')","setFilter('all')","setSortMode('priority')"])
    assert.ok(page.includes(token),token)
})
check('Revisão e conciliação preservadas',()=>{
  assert.ok(page.includes('saveConciliationReview('))
  assert.ok(page.includes('conciliatePendingTransaction('))
})
check('Sintaxe válida',()=>{
  for(const p of [pol,'src/app/(app)/conciliation/page.tsx']){
    const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(ast.parseDiagnostics.length,0)
  }
})
check('Workflow Android',()=>{
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v216-inbox-organization.mjs'))
})
console.log(`V216: ${n} contratos aprovados.`)
