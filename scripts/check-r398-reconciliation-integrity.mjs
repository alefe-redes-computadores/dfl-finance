import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const engine='src/lib/syncEngine.ts'
const policy='src/lib/accountReconciliationPolicy.ts'
const read=p=>fs.readFileSync(p,'utf8')

const transpiled=ts.transpileModule(
  read(policy),
  {
    fileName:policy,
    compilerOptions:{
      module:ts.ModuleKind.CommonJS,
      target:ts.ScriptTarget.ES2022,
    },
  }
).outputText

const mod={exports:{}}
new Function('module','exports',transpiled)(
  mod,mod.exports
)

const {
  protectedReconciliationAccountIds,
  canReconcileAccount,
}=mod.exports

const queue=[
  {table:'accounts',record_id:'conta-pendente'},
  {table:'transactions',record_id:'transacao-1'},
]

const outbox=[
  {table:'accounts',record_id:'conta-atomica'},
  {table:'accounts',record_id:'conta-pendente'},
  {table:'credit_cards',record_id:'cartao-1'},
]

const protectedIds=
  protectedReconciliationAccountIds(queue,outbox)

assert.deepEqual(
  [...protectedIds].sort(),
  ['conta-atomica','conta-pendente']
)

assert.equal(
  canReconcileAccount('conta-atomica',protectedIds),
  false
)

assert.equal(
  canReconcileAccount('conta-pendente',protectedIds),
  false
)

assert.equal(
  canReconcileAccount('conta-remota-livre',protectedIds),
  true
)

const sourceQueue=JSON.stringify(queue)
const sourceOutbox=JSON.stringify(outbox)

protectedReconciliationAccountIds(queue,outbox)

assert.equal(JSON.stringify(queue),sourceQueue)
assert.equal(JSON.stringify(outbox),sourceOutbox)

console.log('OK: fila e outbox protegidos')
console.log('OK: contas livres permanecem elegiveis')
console.log('OK: entradas nao sao modificadas')

const source=read(engine)
const begin=source.indexOf(
  'export async function reconcileAccountBalancesFast('
)
const end=source.indexOf(
  'async function healOrphanAccountSyncStates(',begin
)

assert(begin>=0 && end>begin)

const block=source.slice(begin,end)

for(const contract of [
  'pendingOutbox?.queue ?? []',
  'currentOutbox?.queue ?? []',
  'db.financialOutbox,',
  'transactionProtectedIds',
  'canReconcileAccount(',
  'protectedAccountIds.has(account.id)',
  'currentlyProtected.has(account.id)',
  'currentUserId !== userId',
  'remainingOutbox?.queue ?? []',
  'balanceVerifiedAt: stillProtected ? null : verifiedAt',
]){
  assert(block.includes(contract),contract)
}

assert(
  (block.match(/currentUserId !== userId/g)||[]).length>=4,
  'Checagens de usuario insuficientes'
)

assert(
  block.includes('db.accounts.bulkDelete(staleIds)')
)

assert(
  block.includes("activeQueue")
)

for(const path of [engine,policy]){
  const ast=ts.createSourceFile(
    path,read(path),
    ts.ScriptTarget.Latest,true,
    ts.ScriptKind.TS
  )
  assert.equal(ast.parseDiagnostics.length,0,path)
}

console.log('R398: protecao estrutural e sintaxe OK')
