import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const policy='src/lib/transactionListPolicy.ts'
const hook='src/hooks/useTransactionsList.ts'
const flow=read('.github/workflows/android-build.yml')
const source=read(policy)
const hookSource=read(hook)
let total=0

function check(name,fn) {
  fn()
  total++
  console.log('✓',name)
}

for (const path of [policy,hook]) {
  check('Sintaxe '+path,()=>{
    const ast=ts.createSourceFile(
      path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS
    )
    assert.equal(ast.parseDiagnostics.length,0)
  })
}

const exports={}
new Function('exports',
  ts.transpileModule(source,{
    fileName:policy,
    compilerOptions:{
      module:ts.ModuleKind.CommonJS,
      target:ts.ScriptTarget.ES2020
    }
  }).outputText
)(exports)

const invalid=exports.invalidTransactionDateRange
const tie=exports.transactionStableIdCompare

check('Intervalo valido',()=>{
  assert.equal(invalid('2026-10-01','2026-10-31'),false)
})
check('Intervalo invertido',()=>{
  assert.equal(invalid('2026-11-01','2026-10-31'),true)
})
check('Mesmo dia permitido',()=>{
  assert.equal(invalid('2026-10-24','2026-10-24'),false)
})
check('Limite inicial opcional',()=>{
  assert.equal(invalid(null,'2026-10-31'),false)
})
check('Limite final opcional',()=>{
  assert.equal(invalid('2026-10-01',null),false)
})
check('Sem intervalo permitido',()=>{
  assert.equal(invalid(),false)
})
check('ID igual gera empate',()=>{
  assert.equal(tie({id:'a'},{id:'a'}),0)
})
check('Desempate antissemétrico',()=>{
  assert.equal(
    Math.sign(tie({id:'a'},{id:'b'})),
    -Math.sign(tie({id:'b'},{id:'a'}))
  )
})
check('IDs ausentes aceitos',()=>{
  assert.equal(tie({},{}),0)
})
check('Consulta barra intervalo invalido',()=>{
  assert.ok(hookSource.includes(
    'if (invalidTransactionDateRange(startDate, endDate)) return []'
  ))
})
check('Desempate usado pelo hook',()=>{
  assert.ok(hookSource.includes(
    'return transactionStableIdCompare(a, b)'
  ))
})
check('Ordenacao primaria preservada',()=>{
  assert.ok(hookSource.includes('dateCompare'))
  assert.ok(hookSource.includes('createdCompare'))
})
check('Indice composto preservado',()=>{
  assert.ok(hookSource.includes('[user_id+context+date]'))
})
check('Indice temporal preservado',()=>{
  assert.ok(hookSource.includes('[user_id+date]'))
})
check('Indice de contexto preservado',()=>{
  assert.ok(hookSource.includes('[user_id+context]'))
})
check('Usuario isolado',()=>{
  assert.ok(read(policy).includes("key !== 'user_id'"))
  assert.ok(hookSource.includes('.equals(user.id)'))
})
check('Filtro unico V197 preservado',()=>{
  assert.ok(hookSource.includes('transactionMatchesFilters('))
})
check('Dados reativos preservados',()=>{
  assert.ok(hookSource.includes('useLiveQuery'))
  assert.ok(hookSource.includes('stableLocalRows(data)'))
})
check('Politica sem escrita financeira',()=>{
  assert.ok(!/fetch\(|\.put\(|\.update\(|\.delete\(|\.rpc\(/.test(source))
})
check('Gate Android presente',()=>{
  assert.ok(flow.includes('node scripts/check-v199-query-integrity.mjs'))
})

console.log(`V199: ${total} contratos aprovados.`)
