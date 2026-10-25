import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read = p => fs.readFileSync(p,'utf8')
const policy = 'src/lib/homeOperationalAction.ts'
const home = read('src/app/(app)/home/page.tsx')
const flow = read('.github/workflows/android-build.yml')
const exports = {}
new Function('exports',ts.transpileModule(read(policy),{
  fileName:policy,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(exports)
const decide=exports.homeOperationalAction
let n=0
function check(name,fn){fn();n++;console.log('✓',name)}

check('Revisao e deficit indicam ambas as causas',()=>{
  const a=decide({available:-20,reviewCount:2,hidden:false})
  assert.equal(a.href,'/conciliation')
  assert.match(a.reason,/compromissos acima do saldo/)
})
check('Deficit sem revisao usa contas',()=>{
  assert.equal(decide({available:-20,reviewCount:0,hidden:false}).href,'/accounts')
})
check('Valores protegidos prevalecem',()=>{
  assert.equal(decide({available:-20,reviewCount:2,hidden:true}).href,'/accounts')
})
check('Nao confirma saude financeira com NaN',()=>{
  const a=decide({available:NaN,reviewCount:0,hidden:false})
  assert.equal(a.href,'/planning')
  assert.match(a.reason,/indisponíveis/)
})
check('Planejamento distingue futuro de realizado',()=>{
  assert.match(decide({available:100,reviewCount:0,hidden:false}).reason,/futuros/)
})
check('Nenhuma acao muda entrada',()=>{
  const a={available:30,reviewCount:1,hidden:false}
  decide(a)
  assert.deepEqual(a,{available:30,reviewCount:1,hidden:false})
})
check('Motivo exibido e acessivel',()=>{
  assert.ok(home.includes('{operationalAction.reason}'))
  assert.ok(home.includes('`${operationalAction.label}. ${operationalAction.reason}`'))
})
check('Acao apenas por clique',()=>{
  assert.ok(home.includes('onClick={() => router.push(operationalAction.href)}'))
})
check('Formula original intocada',()=>{
  assert.ok(home.includes('totalAccountsBalance - operationalCommitted'))
})
check('Inbox e diagnostico mantidos',()=>{
  assert.ok(home.includes('homeInboxSummary('))
  assert.ok(home.includes('homeOperationalInsight({'))
})
check('TSX e TS parseaveis',()=>{
  for(const p of [policy,'src/app/(app)/home/page.tsx']){
    const a=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(a.parseDiagnostics.length,0)
  }
})
check('Workflow atualizado',()=>{
  assert.ok(flow.includes('node scripts/check-v208-action-clarity.mjs'))
})
console.log(`V208: ${n} grupos aprovados.`)
