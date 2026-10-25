import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const read=p=>fs.readFileSync(p,'utf8')
const pol='src/lib/intelligenceSearchPolicy.ts'
const center='src/app/(app)/intelligence-center/page.tsx'
const radar='src/app/(app)/cash-pressure/page.tsx'
const content=read(pol)
const js=ts.transpileModule(content,{
  fileName:pol,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText
const exports={}
new Function('exports',js)(exports)
const search=exports.searchIntelligenceGroups
const groups=[{
  id:'review',title:'Conferir',description:'Revisão',
  links:[{id:'a',title:'Conciliação',description:'Importações pendentes',tag:'Inbox',href:'/conciliation'}]
}]
let count=0
const test=(name,fn)=>{fn();count++;console.log('✓',name)}
test('Busca sem acento',()=>{
  assert.equal(search(groups,'all','conciliacao').length,1)
})
test('Busca por termos combinados',()=>{
  assert.equal(search(groups,'all','pendentes importacoes').length,1)
})
test('Filtro por grupo',()=>{
  assert.equal(search(groups,'plan','').length,0)
})
test('Entrada preservada',()=>{
  const before=JSON.stringify(groups)
  search(groups,'all','inbox')
  assert.equal(JSON.stringify(groups),before)
})
test('Busca integrada',()=>{
  assert.ok(read(center).includes('searchIntelligenceGroups(intelligenceGroups, filter, query)'))
})
test('Acesso rápido',()=>{
  for(const path of ['/conciliation','/cash-pressure','/planning'])
    assert.ok(read(center).includes(path))
})
test('Reset completo dos cenários',()=>{
  assert.ok(read(radar).includes("setExtra(''); setCushion('')"))
})
test('Motores financeiros preservados',()=>{
  assert.ok(read(radar).includes('buildFinancePressure('))
  assert.ok(read(radar).includes('buildFinanceAgenda('))
})
test('Sintaxe TypeScript e TSX',()=>{
  for(const p of [pol,center,radar]){
    const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(ast.parseDiagnostics.length,0)
  }
})
test('Android inclui V217',()=>{
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v217-intelligence-radar.mjs'))
})
console.log(`V217: ${count} testes aprovados`)
