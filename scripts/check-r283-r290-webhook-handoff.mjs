import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const path='supabase/functions/_shared/atomicV2WebhookHandoff.ts';
const source=fs.readFileSync(path,'utf8');
const webhook=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8');
assert.ok(webhook.includes('const atomicMode=false;')&&webhook.includes('DFL_R369_ROLLOUT_GATE_UNAVAILABLE'));
assert.ok(webhook.includes("from '../_shared/atomicV2WebhookHandoff.ts'")&&webhook.includes('DFL_BOT_ATOMIC_V2_RELEASE_GATE'),'handoff importado apenas com gate duplo');
assert.ok(!source.includes('bot_record_transaction')&&!source.includes('bot_settle_transaction'),'sem RPC antiga');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.ok(!(compiled.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error));
const calls=[];
let failure=null;
let response={prepare:{phase:'prepared'},commit:{phase:'committed',transaction_id:'id-1'},recover:{phase:'recovered',verified:true,transaction_id:'id-1'}};
const exports={};
vm.runInNewContext(compiled.outputText,{exports,Error,String,Number,Array,require:name=>{assert.equal(name,'./atomicV2Integration.ts');return {runAtomicV2Integration:async(action)=>{calls.push(action);if(failure===action)throw Error('simulated '+action);return response[action]}}}},{timeout:2000});
const {handoffAtomicV2,recoverAtomicV2Handoff}=exports;
const input={db:{},u:{user_id:'u'},phone:'5511999999999',sd:{provider_message_id:'msg',type:'expense',amount:50,description:'teste',context:'dfl',date:'2026-10-26'},acc:{id:'a'},cat:{id:'c'},params:{p_user_id:'u',p_account_id:'a',p_category_id:'c',p_type:'expense',p_amount:50,p_description:'teste',p_context:'dfl',p_date:'2026-10-26',p_idempotency_key:'k'}};
let result=await handoffAtomicV2(input);assert.equal(result.transaction_id,'id-1');assert.deepEqual(calls,['prepare','commit']);
calls.length=0;result=await recoverAtomicV2Handoff(input);assert.equal(result.transaction_id,'id-1');assert.deepEqual(calls,['recover']);
for(const [name,patch] of [['user',{u:{user_id:'x'}}],['account',{acc:{id:'x'}}],['category',{cat:{id:'x'}}],['amount',{sd:{...input.sd,amount:80}}],['description',{sd:{...input.sd,description:'alterado'}}],['date',{sd:{...input.sd,date:'2026-10-25'}}],['recurrence',{sd:{...input.sd,recurrence:{frequency:'monthly'}}}],['key',{params:{...input.params,p_idempotency_key:null}}]]){
 calls.length=0;await assert.rejects(()=>handoffAtomicV2({...input,...patch}),/INVALID_FINANCIAL_IDENTITY/);assert.equal(calls.length,0,name);console.log('OK: invalido rejeitado:',name);
}
for(const stage of ['prepare','commit']){
 calls.length=0;failure=stage;await assert.rejects(()=>handoffAtomicV2(input),/simulated/);assert.deepEqual(calls,stage==='prepare'?['prepare']:['prepare','commit']);failure=null;
}
response={...response,commit:{phase:'committed'}};calls.length=0;await assert.rejects(()=>handoffAtomicV2(input),/COMMIT_UNVERIFIED/);response.commit={phase:'committed',transaction_id:'id-1'};
response.recover={phase:'recovered',verified:false,transaction_id:'id-1'};calls.length=0;await assert.rejects(()=>recoverAtomicV2Handoff(input),/LEDGER_UNVERIFIED/);assert.deepEqual(calls,['recover']);
console.log('R283–R290 R2: 14 cenarios de identidade, falha e recuperacao aprovados. SEM ledger real.');
