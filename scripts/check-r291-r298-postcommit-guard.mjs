import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
const s=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const begin=s.indexOf('/* R291_POSTCOMMIT_VERIFY:')
const end=s.indexOf('let heldReceiptLinked=',begin)
assert.ok(begin>0&&end>begin,'bloco de verificacao nao localizado')
// R299: exercitar apenas a guarda R291; a nova leitura do ledger tem teste proprio.
const ledgerStart=s.indexOf('  /* R299_LEDGER_POSTCOMMIT_VERIFY:',begin)
assert.ok(ledgerStart>begin&&ledgerStart<end,'R299 nao encontrado depois da R291')
const piece=s.slice(begin,ledgerStart)+String.fromCharCode(10)+'}'
assert.ok(!piece.includes('db.rpc('),'sem chamada financeira')
assert.ok(!piece.includes('await save('),'sem sobrescrever sessao')
assert.ok(!piece.includes('await clear('),'sem apagar sessao')
const raw=`async function verify(){${piece}}`
const compiled=ts.transpileModule(raw,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
async function run({atomic=true,step='TX_SETTLE',consumed_at='2026-10-27T12:00:00Z',transaction_id='tx-1',idempotency_key='key-1',recurrence=false,dbError=null,txid='tx-1'}={}){
  let reads=0
  const q={select(){return q},eq(){return q},async maybeSingle(){reads++;return{error:dbError,data:{step,temp_data:{consumed_at,transaction_id,idempotency_key}}}}}
  const context={
  u:{user_id:'u-1'},
  r361IsProtectedCanary:async(userId,txid)=>{
    assert.equal(userId,'u-1')
    assert.ok(txid)
    return true
  },
  r:{data:atomic?{atomic:true}:{}},sd:{recurrence},txid,key:'key-1',phone:'fake',db:{from(table){assert.equal(table,'bot_sessions');return q}},String,Error}
  await vm.runInNewContext(compiled+';verify()',context,{timeout:2000})
  return reads
}
assert.equal(await run(),1)
assert.equal(await run({atomic:false}),0)
for(const x of [{step:'TX_CONFIRM'},{consumed_at:null},{transaction_id:'other'},{idempotency_key:'other'},{recurrence:true},{txid:null},{dbError:new Error('db unavailable')}]){
  await assert.rejects(()=>run(x),/DFL_ATOMIC_POSTCOMMIT_|db unavailable/)
}
assert.equal(s.match(/\}\s*else\s+await\s+save\(phone\s*,\s*["']TX_SETTLE["']/g)?.length,1,'ramo legado inalterado')
assert.ok(s.includes('DFL_R369_ROLLOUT_GATE_UNAVAILABLE'),'V2 deve permanecer bloqueada')
console.log('R291-R298 R3: 9 casos, legado preservado, falha fechada OK')
