import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
const helper=fs.readFileSync('supabase/functions/_shared/atomicBotSingle.ts','utf8')
const sql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026193000_r157_atomic_bot_recovery.sql','utf8')
const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
assert.ok(sql.indexOf('v_result:=public.bot_record_transaction(')<sql.indexOf("set step='TX_SETTLE'"))
assert.ok(sql.includes("'{transaction_id}',to_jsonb(v_result->>'transaction_id'),true"))
assert.ok(sql.includes('DFL_BOT_MISSING_TRANSACTION_ID'))
assert.ok(sql.includes("'{consumed_at}'"))
assert.ok(sql.includes('revision=revision+1'))
assert.ok(sql.includes('DFL_BOT_ALREADY_CONSUMED'))
assert.ok(wh.includes('DFL_BOT_ATOMIC_SINGLE_V1'))
assert.ok(helper.includes('DFL_BOT_ATOMIC_RECOVERY_R157'))
const js=ts.transpileModule(helper,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const scope={exports:{},Number,String,Set,Error};vm.runInNewContext(js,scope,{timeout:1500})
const fn=scope.exports.atomicBotSingle
assert.equal(typeof fn,'function')
const uid='11111111-1111-4111-8111-111111111111',aid='22222222-2222-4222-8222-222222222222',kid='33333333-3333-4333-8333-333333333333'
const u={user_id:uid},acc={id:aid},sd={type:'expense',amount:42,description:'Teste',context:'personal'},params={p_idempotency_key:kid,p_date:'2026-10-26'}
const base={proposal_id:'tx:'+kid,user_id:uid,account_id:aid,category_id:null,idempotency_key:kid,type:'expense',amount:42,description:'Teste',context:'personal',date:'2026-10-26'}
const mk=(step,td)=>{const calls=[];const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{step,revision:5,temp_data:td},error:null})})})}),rpc:async(name,p)=>{calls.push(name);return {data:name==='dfl_bot_session_cas'?{applied:true,revision:6}:{atomic:true,transaction_id:'new'},error:null}}};return {db,calls}}
async function run(row,s=sd,k=params){return fn(row.db,u,'5534999999999',s,acc,null,k,'bot_record_transaction')}
const ok=mk('TX_SETTLE',{...base,consumed_at:'2026-10-26T15:00:00Z',transaction_id:'existing'})
const resumed=await run(ok)
assert.equal(resumed.data.transaction_id,'existing');assert.equal(resumed.data.duplicate,true);assert.equal(ok.calls.length,0)
console.log('OK: retomada retorna ID anterior sem RPC financeira')
for(const [label,step,data,s,k] of [
 ['outra proposta','TX_SETTLE',{...base,proposal_id:'tx:outro',consumed_at:'now',transaction_id:'existing'},sd,params],
 ['sem marcador','TX_SETTLE',{...base,transaction_id:'existing'},sd,params],
 ['conta alterada','TX_SETTLE',{...base,account_id:uid,consumed_at:'now',transaction_id:'existing'},sd,params],
 ['valor alterado','TX_SETTLE',{...base,consumed_at:'now',transaction_id:'existing'},{...sd,amount:50},params],
 ['chave alterada','TX_SETTLE',{...base,consumed_at:'now',transaction_id:'existing'},sd,{...params,p_idempotency_key:uid}],
 ]){
 const x=mk(step,data);await assert.rejects(run(x,s,k));assert.equal(x.calls.length,0);console.log('OK: retry indevido bloqueado - '+label)
}
const fresh=mk('TX_CAT',{...base})
const result=await run(fresh)
assert.equal(result.data.atomic,true)
assert.deepEqual(fresh.calls,['dfl_bot_session_cas','dfl_bot_record_single_atomic_r146'])
console.log('OK: CAS confirma congelamento e apenas uma RPC financeira executada')
console.log('R157–R162: contratos SQL + 7 casos comportamentais passaram')
