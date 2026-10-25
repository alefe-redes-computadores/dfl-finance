import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const policy='src/lib/planningReservePriority.ts'
const page='src/app/(app)/planning/page.tsx'
const read=p=>fs.readFileSync(p,'utf8')
const out={}
new Function('exports',ts.transpileModule(read(policy),{
  fileName:policy,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(out)
const evaluate=out.planningReservePriorities
const make=(id,date,amount=100)=>({
  id,name:id,target_date:date,outstanding:amount,monthlySuggested:20
})
const today='2026-10-24'
let n=0
function test(name,fn){fn();console.log('✓',name);n++}

test('Atrasadas continuam pendentes',()=>{
  assert.equal(evaluate([make('a','2026-10-23')],today).overdue,1)
})
test('Hoje e 30 dias entram como proximas',()=>{
  assert.equal(evaluate([
    make('a',today),make('b','2026-11-23')
  ],today).upcoming,2)
})
test('31 dias nao entram como proximas',()=>{
  assert.equal(evaluate([make('a','2026-11-24')],today).upcoming,0)
})
test('Meta completa nao e pendencia',()=>{
  assert.equal(evaluate([make('a','2026-10-20',0)],today).complete,1)
})
test('Ordenacao consistente e sem mutacao',()=>{
  const rows=[
    make('complete','2026-10-20',0),
    make('future','2026-12-20'),
    make('soon','2026-10-25'),
    make('late','2026-10-10')
  ]
  assert.deepEqual(evaluate(rows,today).entries.map(r=>r.id),
    ['late','soon','future','complete'])
  assert.equal(rows[0].id,'complete')
})
test('NaN nao cria valor pendente',()=>{
  assert.equal(evaluate([make('a','2026-10-10',NaN)],today).complete,1)
})
test('Data invalida bloqueada',()=>{
  assert.throws(()=>evaluate([],'2026-02-31'))
})
test('Edicao preserva fluxo existente',()=>{
  const s=read(page)
  assert.ok(s.includes('planningReservePriorities(data.reserves,now)'))
  assert.ok(s.includes('editReserve(original)'))
  assert.ok(s.includes('planning-reserve-editor'))
  assert.ok(s.includes('saveReserve=async'))
  assert.ok(s.includes('removeReserve=async'))
})
test('Sintaxe TS e TSX',()=>{
  for(const p of [policy,page]){
    const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(ast.parseDiagnostics.length,0)
  }
})
test('Android inclui V211',()=>{
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v211-reserve-priority.mjs'))
})
console.log(`V211: ${n} testes aprovados`)
