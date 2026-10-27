import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const s=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const a=s.indexOf('  /* R130_PLAIN_CONFIRM_GUARD')
const b=s.indexOf('  /* R123:',a)
const c=s.indexOf('  const choice=',a)
const end=b>a?b:c
assert.ok(a>0&&end>a,'bloco de guarda isolavel')
const src=s.slice(a,end)
assert.ok(!src.includes('db.rpc(')&&!src.includes('recordTx('),'nenhuma RPC')
async function trial(n,revision){
 let calls=0
 const ctx={n,sd:{proposal_revision:revision},reply:async()=>{calls++;return 'ok'},done:async()=>{},aid:'fake',Response,Set,Number}
 await vm.runInNewContext('(async()=>{'+src+'})()',ctx,{timeout:2000})
 return calls
}
for(const n of ['sim','1','confirmo','pode registrar','ok']){assert.equal(await trial(n,2),1);console.log('OK bloqueado:',n)}
for(const [n,r] of [['confirmar revisao 2',2],['sim',0],['corrigir',2]]){assert.equal(await trial(n,r),0);console.log('OK preservado:',n,r)}
assert.ok(s.includes('p_idempotency_key:key'))
console.log('R130: 8 cenarios aprovados')
