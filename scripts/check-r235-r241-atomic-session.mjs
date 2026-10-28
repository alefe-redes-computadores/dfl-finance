import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const load=file=>fs.readFileSync(file,'utf8');
const bridge=load('supabase/functions/_shared/atomicBotV2Bridge.ts');
const session=load('supabase/functions/_shared/atomicV2Session.ts');
const wh=load('supabase/functions/whatsapp-webhook/index.ts');
assert.ok(wh.includes('DFL_R369_ROLLOUT_GATE_UNAVAILABLE'));
assert.ok(!wh.includes('atomicBotSingleV2('));
for(const [name,s] of [['bridge',bridge],['session',session]]){
 const ast=ts.createSourceFile(name+'.ts',s,ts.ScriptTarget.Latest,true);
 assert.equal(ast.parseDiagnostics.length,0,'parse '+name);
}
function transpile(src){return ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText}
const modules={};
function evaluate(name,src,req){const exports={};vm.runInNewContext(transpile(src),{exports,require:req,Number,String,Object,Error}, {timeout:2000});modules[name]=exports;return exports;}
const b=evaluate('bridge',bridge,()=>{throw Error('unexpected bridge import')});
const m=evaluate('session',session,name=>{assert.equal(name,'./atomicBotV2Bridge.ts');return b});
const u={user_id:'u-1'},acc={id:'a-1'},cat={id:'c-1'},sd={provider_message_id:'provider-1',type:'expense',amount:70,description:'Mercado',context:'personal',date:'2026-10-26'};
const params={p_idempotency_key:'00000000-0000-4000-8000-000000000001',p_account_id:acc.id,p_category_id:cat.id,p_type:sd.type,p_amount:sd.amount,p_description:sd.description,p_context:sd.context,p_date:sd.date};
const state={phone:'5511999999999',step:'TX_CAT',revision:7,temp_data:{provider_message_id:'provider-1'}};
const good=m.preparedAtomicSession(u,sd,acc,cat,params,state);
assert.equal(good.revision,7);assert.equal(good.snapshot.account_id,acc.id);
for(const change of [{...state,step:'TX_SETTLE'},{...state,revision:-1},{...state,temp_data:{provider_message_id:'wrong'}},{...state,temp_data:{provider_message_id:'provider-1',consumed_at:'now'}},{...state,temp_data:{provider_message_id:'provider-1',transaction_id:'tx'}},{...state,temp_data:{provider_message_id:'provider-1',atomic_snapshot:{...good.snapshot,amount:999}}}])assert.throws(()=>m.preparedAtomicSession(u,sd,acc,cat,params,change),/DFL_V2_/);
for(const field of ['amount','description','context','account_id','category_id','idempotency_key']){
 const mutated={...good.snapshot,[field]:'bad'};
 assert.throws(()=>m.preparedAtomicSession(u,sd,acc,cat,params,{...state,temp_data:{...state.temp_data,atomic_snapshot:mutated}}),/DFL_V2_SNAPSHOT_CHANGED/);
}
assert.equal(m.assertAtomicCommitResult({atomic:true,transaction_id:'tx1',proposal_id:good.snapshot.proposal_id,authorized_revision:7},good),'tx1');
for(const wrong of [{atomic:false,transaction_id:'tx1',proposal_id:good.snapshot.proposal_id,authorized_revision:7},{atomic:true,transaction_id:'tx1',proposal_id:'wrong',authorized_revision:7},{atomic:true,transaction_id:'tx1',proposal_id:good.snapshot.proposal_id,authorized_revision:6}])assert.throws(()=>m.assertAtomicCommitResult(wrong,good),/DFL_V2_/);
const consumed={step:'TX_SETTLE',temp_data:{consumed_at:'2026-10-26T20:00:00Z',transaction_id:'tx1'}};
assert.equal(m.restoredConsumedSession(consumed,{transaction_id:'tx1'}).transaction_id,'tx1');
assert.throws(()=>m.restoredConsumedSession(consumed,{transaction_id:'tx2'}),/DFL_V2_/);
assert.throws(()=>m.restoredConsumedSession({step:'TX_SETTLE',temp_data:{}},null),/DFL_V2_/);
console.log('R235–R241: 22 cenarios de snapshot, consumo, rollback logico e recovery OK');
