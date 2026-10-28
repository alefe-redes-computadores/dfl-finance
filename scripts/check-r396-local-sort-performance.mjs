import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const policy='src/lib/localQueryPolicy.ts'
const read=p=>fs.readFileSync(p,'utf8')

const output=ts.transpileModule(read(policy),{
  fileName:policy,
  compilerOptions:{
    module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2022
  }
}).outputText

const module={exports:{}}
new Function('module','exports',output)(
  module,module.exports
)

const { sortLocalRowsIfNeeded }=module.exports

let compares=0
const compare=(a,b)=>{
  compares++
  return a-b
}

const sorted=[1,2,3,4,5]
assert.strictEqual(
  sortLocalRowsIfNeeded(sorted,compare),
  sorted
)
assert.deepEqual(sorted,[1,2,3,4,5])
console.log('OK: lista ordenada mantém identidade')

const shuffled=[4,1,5,3,2]
assert.deepEqual(
  sortLocalRowsIfNeeded(shuffled,compare),
  [1,2,3,4,5]
)
console.log('OK: lista desordenada corrigida')

assert.deepEqual(
  sortLocalRowsIfNeeded([],compare),[]
)
assert.deepEqual(
  sortLocalRowsIfNeeded([7],compare),[7]
)
console.log('OK: listas pequenas')

const dates=[
  {id:'b',date:'2026-10-28'},
  {id:'a',date:'2026-10-28'},
  {id:'c',date:'2026-10-27'}
]

const chronological=(a,b)=>{
  const byDate=b.date.localeCompare(a.date)
  return byDate || a.id.localeCompare(b.id)
}

assert.deepEqual(
  sortLocalRowsIfNeeded(dates,chronological)
    .map(x=>x.id),
  ['a','b','c']
)
console.log('OK: desempate determinístico')

const withMissing=[
  {id:'a',date:null},
  {id:'b',date:'2026-10-28'}
]

sortLocalRowsIfNeeded(
  withMissing,
  (a,b)=>String(b.date||'').localeCompare(
    String(a.date||'')
  )
)

assert.equal(withMissing[0].id,'b')
console.log('OK: datas ausentes')

const paths=[
  policy,
  'src/hooks/useLocalData.ts',
  'src/hooks/useTransactionsList.ts',
  'src/hooks/useDebtsList.ts'
]

for(const path of paths){
  const ast=ts.createSourceFile(
    path,read(path),
    ts.ScriptTarget.Latest,true,ts.ScriptKind.TS
  )
  assert.equal(ast.parseDiagnostics.length,0,path)
}

const hooks=paths.slice(1).map(read)

for(const source of hooks){
  assert(source.includes('sortLocalRowsIfNeeded('))
  assert(source.includes('stableLocalRows(data)'))
}

assert(hooks[0].includes('localFilterSignature(filters)'))
assert(hooks[0].includes("key !== 'user_id'"))
assert(hooks[1].includes('transactionStableIdCompare'))
assert(hooks[2].includes("where('user_id')"))

for(const source of [read(policy),...hooks]){
  assert(!/\.insert\(|\.update\(|\.delete\(|\.rpc\(/.test(source))
}

console.log('R396: contratos de performance aprovados')
