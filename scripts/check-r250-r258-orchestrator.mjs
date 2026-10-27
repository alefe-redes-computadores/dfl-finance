import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import vm from 'node:vm'
const read=p=>fs.readFileSync(p,'utf8')
const load=(file,dependencies)=>{
 const out=ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}})
 const exports={};vm.runInNewContext(out.outputText,{exports,require:name=>{assert.ok(name in dependencies,'import unexpected: '+name);return dependencies[name]},Error,Number,String,Object},{timeout:3000});return exports
}
const dummy={stageAtomicV2Snapshot:async()=>({revision:2,snapshot:{},step:'TX_CONFIRM'})}
const atomic={atomicBotSingleV2:async()=>({data:{transaction_id:'tx'},error:null})}
const session={restoredConsumedSession:(row,result)=>{if(row.step!=='TX_SETTLE'||!row.temp_data?.consumed_at||!row.temp_data?.transaction_id||row.temp_data.transaction_id!==result.transaction_id)throw Error('invalid consumed');return row.temp_data}}
const o=load('supabase/functions/_shared/atomicV2Orchestrator.ts',{'./atomicV2Stage.ts':dummy,'./atomicBotSingleV2.ts':atomic,'./atomicV2Session.ts':session})
const input={u:{user_id:'owner'},phone:'5511999',sd:{provider_message_id:'message'},acc:{id:'account'},cat:{id:'category'},params:{p_idempotency_key:'key'}}
let calls=0
const row=(state)=>({from:table=>{assert.equal(table,'bot_sessions');return {select(){return this},eq(){return this},async maybeSingle(){calls++;return {data:state,error:null}}}},rpc:async()=>{throw Error('unexpected SQL RPC')}})
const fresh={phone:input.phone,step:'TX_CONFIRM',revision:1,temp_data:{provider_message_id:'message'}}
const prepared={...fresh,revision:2,temp_data:{...fresh.temp_data,atomic_snapshot:{id:'snap'}}}
const consumed={...prepared,step:'TX_SETTLE',temp_data:{...prepared.temp_data,consumed_at:'2026-10-26T10:00:00Z',transaction_id:'tx'}}
const withDb=db=>({...input,db})
assert.equal((await o.prepareAtomicV2Session(withDb(row(fresh)))).revision,2)
assert.ok((await o.commitPreparedAtomicV2(withDb(row(prepared)))).data.transaction_id==='tx')
for(const [label,state] of [['unprepared',fresh],['consumed',consumed]]){
 await assert.rejects(()=>o.commitPreparedAtomicV2(withDb(row(state))))
 console.log('OK: recusa commit',label)
}
await assert.rejects(()=>o.prepareAtomicV2Session(withDb(row(consumed))))
assert.equal((await o.inspectAtomicV2Recovery(row(consumed),input.phone)).requiresLedgerVerification,true)
await assert.rejects(()=>o.inspectAtomicV2Recovery(row(prepared),input.phone))
const source=read('supabase/functions/_shared/atomicV2Orchestrator.ts')
const webhook=read('supabase/functions/whatsapp-webhook/index.ts')
assert.ok(!/bot_record_transaction|bot_record_transfer|bot_settle_transaction/.test(source.replace(/\/\*[\s\S]*?\*\//g,'')),'sem RPC legada no orquestrador')
assert.ok(source.includes('RECOVERY_REQUIRES_LEDGER_PROOF'),'recuperacao nao concede sucesso prematuro')
assert.ok(webhook.includes('const atomicMode=false;')&&webhook.includes('DFL_ATOMIC_V2_NOT_RELEASED'),'ativacao protegida')
assert.ok(!webhook.includes('atomicV2Orchestrator.ts'),'sem conexao prematura')
console.log('R250-R258: pré-orquestrador, fail-closed e recuperação conservadora PASS')
