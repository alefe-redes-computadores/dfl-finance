import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const read=p=>fs.readFileSync(p,'utf8')
const pol='src/lib/conciliationViewPolicy.ts'
const page='src/app/(app)/conciliation/page.tsx'
const out={}
new Function('exports',ts.transpileModule(read(pol),{
  fileName:pol,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(out)
const filter=out.filterConciliationView
const rows=[
  {description:'Manutenção carro',type:'expense',source:'whatsapp'},
  {description:'Salário',type:'income',source:'manual'},
  {description:'IPVA',type:'expense',source:'csv_import'}
]
let count=0
function check(name,fn){fn();count++;console.log('✓',name)}
check('Busca ignora acentos',()=>{
  assert.equal(filter(rows,'all','manutencao').length,1)
})
check('Busca encontra origem',()=>{
  assert.equal(filter(rows,'all','csv').length,1)
})
check('Busca multiplos termos',()=>{
  assert.equal(filter(rows,'all','carro manutencao').length,1)
})
check('Filtro entradas',()=>{
  assert.equal(filter(rows,'income','').length,1)
})
check('Filtro saidas',()=>{
  assert.equal(filter(rows,'expense','').length,2)
})
check('Filtros combinados',()=>{
  assert.equal(filter(rows,'expense','salario').length,0)
})
check('Entrada imutavel',()=>{
  const prev=JSON.stringify(rows)
  filter(rows,'all','ipva')
  assert.equal(JSON.stringify(rows),prev)
})
check('UI filtra sem mudar Inbox base',()=>{
  const s=read(page)
  assert.ok(s.includes('filterConciliationView(visible, direction, search)'))
  assert.ok(s.includes('displayed.map((tx: any)'))
  assert.ok(s.includes('belongsInFinancialInbox(tx, today)'))
})
check('Revisao e conciliacao originais',()=>{
  const s=read(page)
  assert.ok(s.includes('saveConciliationReview('))
  assert.ok(s.includes('conciliatePendingTransaction('))
})
check('Sintaxe TS e TSX',()=>{
  for(const p of [pol,page]){
    const a=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(a.parseDiagnostics.length,0)
  }
})
check('Gate Android',()=>{
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v215-conciliation-view.mjs'))
})
console.log(`V215: ${count} contratos aprovados.`)
