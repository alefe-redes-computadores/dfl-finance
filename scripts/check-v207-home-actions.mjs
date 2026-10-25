import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const file='src/lib/homeOperationalAction.ts'
const out={}
new Function('exports',ts.transpileModule(read(file),{
  fileName:file,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(out)

const decide=out.homeOperationalAction
const home=read('src/app/(app)/home/page.tsx')
const flow=read('.github/workflows/android-build.yml')
let count=0
function test(name,fn){fn();count++;console.log('✓',name)}

test('Privacidade prevalece',()=>{
  assert.equal(decide({available:-500,reviewCount:3,hidden:true}).href,'/accounts')
})
test('Revisao exige Inbox',()=>{
  assert.equal(decide({available:100,reviewCount:2,hidden:false}).href,'/conciliation')
})
test('Deficit exige conferir contas',()=>{
  assert.equal(decide({available:-1,reviewCount:0,hidden:false}).href,'/accounts')
})
test('Resultado organizado oferece planejamento',()=>{
  assert.equal(decide({available:100,reviewCount:0,hidden:false}).href,'/planning')
})
test('NaN nao provoca deficit falso',()=>{
  assert.equal(decide({available:NaN,reviewCount:0,hidden:false}).href,'/planning')
})
test('Nenhuma mutacao financeira',()=>{
  const data={available:-100,reviewCount:2,hidden:false}
  const previous={...data}
  decide(data)
  assert.deepEqual(data,previous)
})
test('Home integra decisao',()=>{
  assert.ok(home.includes('homeOperationalAction({'))
  assert.ok(home.includes('router.push(operationalAction.href)'))
  assert.ok(home.includes('operationalAction.reason}'))
})
test('Formula financeira intocada',()=>{
  assert.ok(home.includes('totalAccountsBalance - operationalCommitted'))
})
test('Politicas anteriores preservadas',()=>{
  assert.ok(home.includes('homeInboxSummary('))
  assert.ok(home.includes('homeOperationalInsight({'))
})
test('Sintaxe TSX e TS',()=>{
  for(const p of [file,'src/app/(app)/home/page.tsx']){
    const parsed=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(parsed.parseDiagnostics.length,0)
  }
})
test('Android inclui V207',()=>{
  assert.ok(flow.includes('node scripts/check-v207-home-actions.mjs'))
})
console.log(`V207: ${count} grupos de contratos aprovados.`)
