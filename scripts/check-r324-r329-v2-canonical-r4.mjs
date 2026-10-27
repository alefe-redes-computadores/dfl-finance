import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
const read=p=>fs.readFileSync(p,'utf8')
const stage=read('supabase/functions/_shared/atomicV2Stage.ts')
const helper=read('supabase/functions/_shared/atomicBotSingleV2.ts')
const bridge=read('supabase/functions/_shared/atomicBotV2Bridge.ts')
const session=read('supabase/functions/_shared/atomicV2Session.ts')
const sql=read('docs/sql-candidates/historical-test-fixtures/20261026220000_r219_bot_atomic_v2_consolidated.sql')
const wh=read('supabase/functions/whatsapp-webhook/index.ts')
const compile=(name,source)=>{
 const parsed=ts.createSourceFile(name+'.ts',source,ts.ScriptTarget.Latest,true)
 assert.equal(parsed.parseDiagnostics.length,0,name+' syntax')
 return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
}
const load=(name,source,req=()=>{throw Error('import inesperado')})=>{
 const exports={}
 vm.runInNewContext(compile(name,source),{exports,require:req,Number,String,Object,Error},{timeout:2000})
 return exports
}
const b=load('bridge',bridge)
const m=load('session',session,n=>{assert.equal(n,'./atomicBotV2Bridge.ts');return b})
const st=load('stage',stage,n=>{assert.equal(n,'./atomicV2Session.ts');return m})
const v2=load('v2',helper)
assert.equal(typeof st.stageAtomicV2Snapshot,'function')
assert.equal(typeof v2.atomicBotSingleV2,'function')
const key='44444444-4444-4444-8444-444444444444'
const u={user_id:'11111111-1111-4111-8111-111111111111'}
const acc={id:'22222222-2222-4222-8222-222222222222'}
const cat={id:'33333333-3333-4333-8333-333333333333'}
const sd={provider_message_id:'provider-message',type:'expense',amount:75.2,description:'Teste V2',context:'dfl',date:'2026-10-27'}
const params={p_user_id:u.user_id,p_account_id:acc.id,p_category_id:cat.id,p_type:sd.type,p_amount:sd.amount,p_description:sd.description,p_context:sd.context,p_date:sd.date,p_idempotency_key:key}
const current={phone:'5534999999999',step:'TX_CAT',revision:7,temp_data:{provider_message_id:sd.provider_message_id,held_receipt_path:'safe/receipt.pdf'}}
let calls=[]
const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{applied:true,revision:8},error:null}}}
const staged=await st.stageAtomicV2Snapshot(db,u,current.phone,sd,acc,cat,params,current)
assert.equal(staged.revision,8)
assert.equal(calls.length,1)
assert.equal(calls[0].name,'dfl_bot_session_cas')
const next=calls[0].args.p_new_temp_data
for(const k of ['proposal_id','user_id','account_id','category_id','idempotency_key','type','amount','description','context','date','provider_message_id']){
 assert.ok(Object.hasOwn(next,k),'campo de topo '+k)
 assert.equal(String(next[k]),String(next.atomic_snapshot[k]),'snapshot congruente '+k)
}
assert.equal(next.held_receipt_path,current.temp_data.held_receipt_path,'comprovante preservado')
assert.equal(calls[0].args.p_expected_revision,7)
console.log('OK: CAS persiste snapshot no topo e aninhado, preserva comprovante')
const consumed={step:'TX_SETTLE',revision:8,temp_data:{...next,transaction_id:'tx-id',consumed_at:'2026-10-27T12:00:00Z'}}
let ledgerCalls=0
const fake={from(name){assert.equal(name,'bot_sessions');return {select(){return this},eq(){return this},async maybeSingle(){return {data:consumed,error:null}}}},async rpc(){ledgerCalls++;throw Error('RPC financeira proibida no retry')}}
await assert.rejects(()=>v2.atomicBotSingleV2(fake,u,current.phone,sd,acc,cat,params),/retry exige comprovacao via ledger/)
assert.equal(ledgerCalls,0,'nenhuma RPC financeira para retry')
console.log('OK: sessao consumida isoladamente nao confirma recuperacao')
assert.ok(sql.includes("if nullif(result->>'transaction_id','') is null"),'SQL exige transaction_id')
assert.ok(sql.includes("return result || jsonb_build_object('atomic',true,'authorized_revision',p_expected_revision,'proposal_id',p_proposal_id);"),'SQL ja retorna dados originais e metadados atomicos')
assert.ok(wh.includes('DFL_ATOMIC_V2_NOT_RELEASED'),'V2 continua bloqueada')
console.log('R324–R329 R4: contratos funcionais aprovados, SQL consolidado preservado')
