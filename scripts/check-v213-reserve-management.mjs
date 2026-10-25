import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const file='src/lib/planningReserveSearch.ts'
const page=read('src/app/(app)/planning/page.tsx')
const out={}
new Function('exports',ts.transpileModule(read(file),{
  fileName:file,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(out)

const filter=out.filterPlanningReserves
const summary=out.reserveVisibleSummary
const rows=[
  {id:'1',name:'IPVA 2026',status:'overdue',outstanding:500},
  {id:'2',name:'Manutenção',status:'upcoming',outstanding:150},
  {id:'3',name:'Viagem',status:'future',outstanding:400},
  {id:'4',name:'Férias',status:'complete',outstanding:0}
]
let n=0
function test(name,fn){fn();console.log('✓',name);n++}

test('Busca ignora acentos',()=>{
  assert.deepEqual(filter(rows,'all','manutencao').map(x=>x.id),['2'])
})
test('Busca aceita multiplos termos',()=>{
  assert.deepEqual(filter(rows,'all','2026 ipva').map(x=>x.id),['1'])
})
test('Filtro vencidas',()=>{
  assert.deepEqual(filter(rows,'overdue','').map(x=>x.id),['1'])
})
test('Filtro urgentes preservado',()=>{
  assert.deepEqual(filter(rows,'urgent','').map(x=>x.id),['1','2'])
})
test('Todas inclui concluidas',()=>{
  assert.equal(filter(rows,'all','').length,4)
})
test('Concluidas isoladas',()=>{
  assert.deepEqual(filter(rows,'complete','').map(x=>x.id),['4'])
})
test('Resumo nao inclui metas ocultas',()=>{
  assert.equal(summary(filter(rows,'overdue','')).outstanding,500)
})
test('Valores invalidos ignorados',()=>{
  assert.equal(summary([{...rows[0],outstanding:NaN}]).outstanding,0)
})
test('Sem mutacao da entrada',()=>{
  const old=JSON.stringify(rows)
  filter(rows,'all','ipva')
  assert.equal(JSON.stringify(rows),old)
})
test('Busca e resumo integrados',()=>{
  assert.ok(page.includes('filterPlanningReserves(reservePriority.entries,reserveView,reserveSearch)'))
  assert.ok(page.includes('reserveVisibleSummary(reserveVisible)'))
})
test('Edicao e gravação originais',()=>{
  assert.ok(page.includes('editReserve(original)'))
  assert.ok(page.includes('saveReserve=async'))
  assert.ok(page.includes('removeReserve=async'))
})
test('Sintaxe TS e TSX',()=>{
  for(const p of [file,'src/app/(app)/planning/page.tsx']){
    const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,
      p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
    assert.equal(ast.parseDiagnostics.length,0)
  }
})
test('Workflow atualizado',()=>{
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v213-reserve-management.mjs'))
})
console.log(`V213: ${n} contratos aprovados`)
