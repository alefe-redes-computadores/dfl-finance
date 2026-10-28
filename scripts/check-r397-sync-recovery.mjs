import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const engine='src/lib/syncEngine.ts'
const policy='src/lib/syncRecoveryPolicy.ts'

const read=p=>fs.readFileSync(p,'utf8')

const compiled=ts.transpileModule(read(policy),{
  fileName:policy,
  compilerOptions:{
    module:ts.ModuleKind.CommonJS,
    target:ts.ScriptTarget.ES2022,
  },
}).outputText

const module={exports:{}}

new Function('module','exports',compiled)(
  module,module.exports
)

const {
  mergeSyncRequests,
  syncRetryDelayMs,
  isSyncRetryDue
}=module.exports

const combinations=[
  [{forcePull:false,forcePushRetry:false},
   {forcePull:false,forcePushRetry:true},
   {forcePull:false,forcePushRetry:true}],
  [{forcePull:true,forcePushRetry:false},
   {forcePull:false,forcePushRetry:true},
   {forcePull:true,forcePushRetry:true}],
  [{forcePull:false,forcePushRetry:true},
   {forcePull:true,forcePushRetry:false},
   {forcePull:true,forcePushRetry:true}],
]

for(const [a,b,expected] of combinations){
  assert.deepEqual(mergeSyncRequests(a,b),expected)
}

console.log('OK: pedidos concorrentes combinados')

const delays=[
  [0,0],
  [1,30000],
  [2,60000],
  [3,120000],
  [4,300000],
  [5,900000],
  [6,1800000],
  [20,1800000],
]

for(const [attempts,expected] of delays){
  assert.equal(syncRetryDelayMs(attempts),expected)
}

console.log('OK: backoff original preservado')

const now=Date.parse('2026-10-28T12:00:00.000Z')
const last=new Date(now-60000).toISOString()

assert.equal(
  isSyncRetryDue({attempts:1,last_attempt_at:last},now),
  true
)

assert.equal(
  isSyncRetryDue({attempts:3,last_attempt_at:last},now),
  false
)

assert.equal(
  isSyncRetryDue({attempts:3,last_attempt_at:'invalida'},now),
  true
)

assert.equal(
  isSyncRetryDue({attempts:0},now),
  true
)

console.log('OK: retry devido e indisponivel')

const source=read(engine)

for(const term of [
  'mergeSyncRequests(queuedForceRequest, incomingRequest)',
  'queuedForceRequest = null',
  'request.forcePull',
  'request.forcePushRetry',
  'if (activeSyncPromise)',
  'pushAtomicFinancialBatch',
  'confirmSyncSuccessIfCurrent',
  'markSyncFailedIfCurrent',
  'isSyncRetryDue(item, Date.now())',
]){
  assert(source.includes(term),term)
}

for(const path of [engine,policy]){
  const ast=ts.createSourceFile(
    path,read(path),
    ts.ScriptTarget.Latest,true,
    ts.ScriptKind.TS
  )
  assert.equal(ast.parseDiagnostics.length,0,path)
}

console.log('R397: contratos de concorrencia e retry aprovados')
