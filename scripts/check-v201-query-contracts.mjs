import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const policy='src/lib/transactionListPolicy.ts'
const hook='src/hooks/useTransactionsList.ts'
const read=p=>fs.readFileSync(p,'utf8')

const exports={}
new Function('exports',ts.transpileModule(read(policy),{
  fileName:policy,
  compilerOptions:{
    module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2020
  }
}).outputText)(exports)

const {activeTransactionFilters:active,
  transactionMatchesFilters:matches}=exports
let n=0
const test=(name,fn)=>{
  fn()
  n++
  console.log('✓',name)
}

test('Filtro ausente',()=>{
  assert.deepEqual(active(),[])
})
test('Usuario nao pode ser sobrescrito',()=>{
  assert.deepEqual(active({user_id:'outro'}),[])
})
test('Zero e false permanecem',()=>{
  assert.deepEqual(active({amount:0,active:false}),[
    ['amount',0],['active',false]
  ])
})
test('Null undefined e vazio ignorados',()=>{
  assert.deepEqual(active({
    a:null,b:undefined,c:'',d:'ok'
  }),[['d','ok']])
})
test('Filtros sao AND',()=>{
  const f=active({status:'pending',amount:10})
  assert.equal(matches({status:'pending',amount:10},f),true)
  assert.equal(matches({status:'paid',amount:10},f),false)
  assert.equal(matches({status:'pending',amount:20},f),false)
})
test('Comparacao estrita preservada',()=>{
  assert.equal(matches({amount:'10'},active({amount:10})),false)
})
test('Zero registros nao geram resultado fantasma',()=>{
  const f=active({status:'pending'})
  assert.deepEqual([].filter(x=>matches(x,f)),[])
})
test('1000 filtros equivalentes ao algoritmo anterior',()=>{
  const entries=[
    {amount:0,active:false,status:'pending'},
    {amount:25,active:true,status:'done'},
    {amount:0,active:true,status:'pending'}
  ]
  for(let i=0;i<1000;i++){
    const f={
      status:i%2?'pending':'done',
      amount:i%3?0:25,
      active:i%5===0
    }
    const legacy=Object.entries(f).filter(
      ([k,v])=>k!=='user_id'&&v!==undefined&&v!==null&&v!==''
    )
    assert.deepEqual(
      entries.filter(x=>legacy.every(([k,v])=>x[k]===v)),
      entries.filter(x=>matches(x,active(f)))
    )
  }
})
test('Hook utiliza politica central',()=>{
  assert.ok(read(hook).includes('activeTransactionFilters(filters)'))
  assert.ok(read(hook).includes('transactionMatchesFilters(item, activeFilters)'))
})
test('Indices financeiros preservados',()=>{
  for(const index of [
    '[user_id+context+date]',
    '[user_id+date]',
    '[user_id+context]'
  ]) assert.ok(read(hook).includes(index))
})
test('Sem escrita no ledger',()=>{
  assert.ok(!/\.put\(|\.update\(|\.delete\(|fetch\(/.test(read(policy)))
})
test('Workflow Android exige V201',()=>{
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v201-query-contracts.mjs'))
})
console.log(`V201: ${n} contratos aprovados.`)
