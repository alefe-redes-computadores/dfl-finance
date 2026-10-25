import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const policy='src/lib/homeInboxSummary.ts'
const home=read('src/app/(app)/home/page.tsx')
const flow=read('.github/workflows/android-build.yml')
const out={}
new Function('exports',ts.transpileModule(read(policy),{
  fileName:policy,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(out)

const summary=out.homeInboxSummary
let n=0
const check=(name,fn)=>{fn();console.log('✓',name);n++}

check('Nenhuma pendencia',()=>{
  assert.equal(summary(0,0).title,'Tudo em dia')
  assert.equal(summary(0,0).other,0)
})
check('Somente revisao',()=>{
  const x=summary(3,3)
  assert.equal(x.review,3)
  assert.equal(x.other,0)
})
check('Somente classificadas',()=>{
  const x=summary(4,0)
  assert.equal(x.review,0)
  assert.equal(x.other,4)
})
check('Misto sem dupla contagem',()=>{
  const x=summary(5,3)
  assert.equal(x.title,'3 para revisar')
  assert.equal(x.other,2)
  assert.ok(x.detail.includes('2 outras pendências'))
})
check('Singular correto',()=>{
  assert.ok(summary(2,1).detail.includes('1 outra pendência'))
})
check('Entradas negativas e NaN seguras',()=>{
  assert.equal(summary(-10,NaN).total,0)
})
check('Revisao limitada ao total',()=>{
  assert.equal(summary(2,10).review,2)
})
check('Matriz de mil cenarios sem duplicacao',()=>{
  for(let total=0;total<100;total++){
    for(let review=0;review<10;review++){
      const x=summary(total,review)
      assert.equal(x.review+x.other,x.total)
      assert.ok(x.review>=0 && x.other>=0)
    }
  }
})
check('Home integra politica unica',()=>{
  assert.ok(home.includes('homeInboxSummary(pendings.actionableCount, pendings.reviewCount)'))
  assert.ok(home.includes('aria-label={inboxSummary.accessible}'))
  assert.ok(home.includes('{inboxSummary.title}'))
  assert.ok(home.includes('{inboxSummary.detail}'))
})
check('Saldos, contexto e sync preservados',()=>{
  for(const token of [
    'formatCurrency(operationalAvailable)',
    "hideBalance ? '••••'",
    'effectiveContext','reconcileBalance','lastSyncError'
  ]) assert.ok(home.includes(token),token)
})
check('Sintaxe TSX e TypeScript',()=>{
  for(const p of ['src/app/(app)/home/page.tsx',policy]){
    const parsed=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(parsed.parseDiagnostics.length,0)
  }
})
check('Android exige V204',()=>{
  assert.ok(flow.includes('node scripts/check-v204-home-inbox.mjs'))
})
console.log(`V204: ${n} grupos de contratos aprovados.`)
