import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const read=p=>fs.readFileSync(p,'utf8')
const path='src/lib/pressureCurrencyInput.ts'
const page=read('src/app/(app)/cash-pressure/page.tsx')
const out={}
new Function('exports',ts.transpileModule(read(path),{
  fileName:path,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(out)
const parse=out.parsePressureMoney
let count=0
function test(name,fn){fn();count++;console.log('✓',name)}

test('Vazio representa cenário sem gasto extra',()=>{
  assert.equal(parse(''),0)
})
test('Moeda brasileira com milhar',()=>{
  assert.equal(parse('R$ 1.234,56'),1234.56)
})
test('Moeda brasileira sem milhar',()=>{
  assert.equal(parse('1200,50'),1200.5)
})
test('Decimal com ponto',()=>{
  assert.equal(parse('1200.50'),1200.5)
})
test('Formato incompleto rejeitado',()=>{
  assert.equal(parse('1.234,'),null)
})
test('Separadores inválidos rejeitados',()=>{
  assert.equal(parse('1,2,3'),null)
})
test('Negativos e valores enormes rejeitados',()=>{
  assert.equal(parse('-100'),null)
  assert.equal(parse('100000001'),null)
})
test('Precisão acima de centavos rejeitada',()=>{
  assert.equal(parse('1,234'),null)
})
test('Campos com acessibilidade',()=>{
  assert.ok(page.includes('aria-invalid={parsedExtra===null}'))
  assert.ok(page.includes('aria-invalid={parsedCushion===null}'))
})
test('Aviso de cenário inválido',()=>{
  assert.ok(page.includes('{invalidScenario && ('))
})
test('Motores de cenário preservados',()=>{
  assert.ok(page.includes('buildFinancePressure('))
  assert.ok(page.includes('buildFinanceAgenda('))
})
test('Sintaxe TS e TSX',()=>{
  for(const p of [path,'src/app/(app)/cash-pressure/page.tsx']){
    const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(ast.parseDiagnostics.length,0)
  }
})
test('Gate Android',()=>{
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v218-pressure-input.mjs'))
})
console.log(`V218: ${count} contratos aprovados.`)
