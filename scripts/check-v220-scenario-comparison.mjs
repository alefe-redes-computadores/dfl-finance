import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const pol='src/lib/pressureScenarioComparison.ts'
const page='src/app/(app)/cash-pressure/page.tsx'
const out={}
new Function('exports',ts.transpileModule(read(pol),{
  fileName:pol,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(out)
const compare=out.pressureScenarioComparison
let n=0
function test(name,fn){fn();n++;console.log('✓',name)}

const base={baseline:1000,simulated:500,extraExpense:500,loading:false}

test('Gasto reduz cenário',()=>{
  assert.equal(compare(base).impact,-500)
})
test('Sem gasto gera impacto zero',()=>{
  assert.equal(compare({...base,simulated:1000,extraExpense:0}).impact,0)
})
test('Valores ausentes bloqueiam comparação',()=>{
  assert.equal(compare({...base,baseline:null}).ready,false)
})
test('Carregamento bloqueia conclusão',()=>{
  assert.equal(compare({...base,loading:true}).ready,false)
})
test('NaN não gera comparação falsa',()=>{
  assert.equal(compare({...base,simulated:NaN}).ready,false)
})
test('Valores de entrada não mudam',()=>{
  const copy={...base}
  compare(base)
  assert.deepEqual(base,copy)
})
test('UI liga motores existentes',()=>{
  const s=read(page)
  assert.ok(s.includes('pressureScenarioComparison({'))
  assert.ok(s.includes('baseline:pressure.endConservative'))
  assert.ok(s.includes('simulated:pressure.endSimulated'))
  assert.ok(s.includes('buildFinancePressure('))
})
test('Atalhos somente modificam hipótese',()=>{
  const s=read(page)
  assert.ok(s.includes('([100,500,1000] as const)'))
  assert.ok(s.includes('onClick={()=>setExtra(String(value))}'))
})
test('Entrada inválida impede comparação',()=>{
  assert.ok(read(page).includes('loading:loading||invalidScenario'))
})
test('Sintaxe TS e TSX',()=>{
  for(const p of [pol,page]){
    const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(ast.parseDiagnostics.length,0)
  }
})
test('Pipeline Android',()=>{
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v220-scenario-comparison.mjs'))
})
console.log(`V220: ${n} testes aprovados.`)
