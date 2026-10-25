import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const pol='src/lib/planningDecisionPolicy.ts'
const page='src/app/(app)/planning/page.tsx'
const exports={}
new Function('exports',ts.transpileModule(read(pol),{
  fileName:pol,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(exports)
const decide=exports.planningDecision
const base={
  flexibleLimit:1000,flexibleRemaining:500,
  flexiblePaceDelta:-100,reserveOutstanding:600,
  reserveMonthlySuggested:100,reserveCount:2
}
let n=0
function test(label,fn){fn();console.log('✓',label);n++}
test('Planejamento equilibrado',()=>{
  assert.equal(decide(base).excess,false)
  assert.equal(decide(base).reserveCount,2)
})
test('Excesso de ritmo',()=>{
  assert.equal(decide({...base,flexiblePaceDelta:30}).excess,true)
})
test('Limite atingido',()=>{
  const a=decide({...base,flexibleRemaining:0})
  assert.equal(a.limitReached,true)
  assert.match(a.explanation,/saldo bancário negativo/)
})
test('Sem limite nao afirma ritmo',()=>{
  const a=decide({...base,flexibleLimit:null,flexibleRemaining:null,flexiblePaceDelta:null})
  assert.equal(a.hasLimit,false)
})
test('Reserva nao vira transacao',()=>{
  const a=decide(base)
  assert.equal(a.reserveOutstanding,600)
  assert.equal(a.reserveMonthlySuggested,100)
})
test('Dados invalidos normalizados',()=>{
  const a=decide({...base,reserveOutstanding:NaN,reserveMonthlySuggested:Infinity,reserveCount:-5})
  assert.equal(a.reserveOutstanding,0)
  assert.equal(a.reserveMonthlySuggested,0)
  assert.equal(a.reserveCount,0)
})
test('Funcao nao modifica dados',()=>{
  const copy={...base}
  decide(base)
  assert.deepEqual(base,copy)
})
test('Integracao preserva motor original',()=>{
  const s=read(page)
  assert.ok(s.includes('buildFinancePlanning('))
  assert.ok(s.includes('planningDecision({'))
  assert.ok(s.includes('saveReserve=async'))
  assert.ok(s.includes('saveCap=async'))
  assert.ok(s.includes('saveBucket=async'))
})
test('Rotas de navegacao preservadas',()=>{
  const s=read(page)
  for(const r of ['/home','/transactions','/conciliation','/cash-pressure']){
    assert.ok(s.includes(r))
  }
})
test('Sintaxe dos dois arquivos',()=>{
  for(const p of [pol,page]){
    const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(ast.parseDiagnostics.length,0)
  }
})
test('Pipeline Android inclui V210',()=>{
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v210-planning-decision.mjs'))
})
console.log(`V210: ${n} grupos aprovados.`)
