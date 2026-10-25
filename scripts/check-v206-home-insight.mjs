import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const policy='src/lib/homeOperationalInsight.ts'
const home=read('src/app/(app)/home/page.tsx')
const flow=read('.github/workflows/android-build.yml')

const exports={}
new Function('exports',ts.transpileModule(read(policy),{
  fileName:policy,
  compilerOptions:{
    module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2020
  }
}).outputText)(exports)

const insight=exports.homeOperationalInsight
let n=0
function test(name,fn) {
  fn()
  console.log('✓',name)
  n++
}

test('Deficit operacional',()=>{
  assert.match(insight({available:-100,committed:200,reviewCount:0}),/superam/)
})
test('Deficit tem prioridade sobre revisao',()=>{
  assert.match(insight({available:-1,committed:5,reviewCount:3}),/Atenção/)
})
test('Revisao pede conferencia',()=>{
  assert.match(insight({available:500,committed:50,reviewCount:2}),/Inbox/)
})
test('Compromissos descontados',()=>{
  assert.match(insight({available:500,committed:20,reviewCount:0}),/descontados/)
})
test('Sem compromissos',()=>{
  assert.match(insight({available:500,committed:0,reviewCount:0}),/Nenhum/)
})
test('Numeros invalidos protegidos',()=>{
  assert.match(insight({available:NaN,committed:0,reviewCount:0}),/não disponíveis/)
  assert.match(insight({available:0,committed:Infinity,reviewCount:0}),/não disponíveis/)
})
test('Nenhuma mutacao dos valores',()=>{
  const data={available:700,committed:200,reviewCount:1}
  const before={...data}
  insight(data)
  assert.deepEqual(data,before)
})
test('Home exibe insight so quando autorizado',()=>{
  assert.ok(home.includes("hideBalance\n                        ? 'Análise financeira oculta"))
  assert.ok(home.includes(': operationalInsight}'))
})
test('Formula financeira preservada',()=>{
  assert.ok(home.includes('totalAccountsBalance - operationalCommitted'))
})
test('Sync e Inbox preservados',()=>{
  assert.ok(home.includes('reconcileBalance'))
  assert.ok(home.includes('homeInboxSummary('))
})
test('Sintaxe TS e TSX',()=>{
  for(const p of [policy,'src/app/(app)/home/page.tsx']){
    const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(ast.parseDiagnostics.length,0)
  }
})
test('Android exige V206',()=>{
  assert.ok(flow.includes('node scripts/check-v206-home-insight.mjs'))
})
console.log(`V206: ${n} contratos aprovados.`)
