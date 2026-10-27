import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
const read=f=>fs.readFileSync(f,'utf8');
const transpile=(s)=>ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const load=(path,requireFn)=>{const exports={};vm.runInNewContext(transpile(read(path)),{exports,require:requireFn,Number,String,Object,Error},{timeout:2000});return exports;};
const bridge=load('supabase/functions/_shared/atomicBotV2Bridge.ts',()=>{throw Error('bridge import inesperado')});
const session=load('supabase/functions/_shared/atomicV2Session.ts',name=>{assert.equal(name,'./atomicBotV2Bridge.ts');return bridge});
const stage=load('supabase/functions/_shared/atomicV2Stage.ts',name=>{assert.equal(name,'./atomicV2Session.ts');return session});
const w=read('supabase/functions/whatsapp-webhook/index.ts');
assert.ok(w.includes('DFL_ATOMIC_V2_NOT_RELEASED')&&w.includes('const atomicMode=false;'));
assert.ok(!w.includes("import { atomicBotSingleV2 }"));
const s=read('supabase/functions/_shared/atomicV2Stage.ts');
assert.ok(!/bot_record_transaction|bot_record_transfer|bot_settle_transaction/.test(s),'staging nao movimenta dinheiro');
const u={user_id:'owner'},acc={id:'bank'},cat={id:'category'};
const sd={provider_message_id:'message1',description:'Compra',type:'expense',amount:45,context:'personal',date:'2026-10-26'};
const params={p_user_id:'owner',p_account_id:'bank',p_category_id:'category',p_type:'expense',p_amount:45,p_description:'Compra',p_context:'personal',p_date:'2026-10-26',p_idempotency_key:'unique-id'};
const current={phone:'5511999999999',step:'TX_CAT',revision:3,temp_data:{provider_message_id:'message1'}};
let calls=[];
const db={rpc:async(name,args)=>{calls.push({name,args});return {data:{applied:true,revision:4},error:null}}};
const run=(overrides={})=>stage.stageAtomicV2Snapshot(overrides.db||db,u,overrides.phone||current.phone,overrides.sd||sd,acc,cat,overrides.params||params,overrides.current||current);
const out=await run();
assert.equal(out.revision,4);assert.equal(calls.length,1);assert.equal(calls[0].name,'dfl_bot_session_cas');
assert.equal(calls[0].args.p_expected_step,'TX_CAT');assert.equal(calls[0].args.p_new_step,'TX_CAT');
assert.equal(calls[0].args.p_expected_revision,3);assert.equal(calls[0].args.p_new_temp_data.atomic_snapshot.account_id,'bank');
console.log('OK: CAS persiste snapshot com revisao +1, sem gravacao financeira');
for(const [name,opts] of [
 ['telefone divergente',{phone:'wrong'}],
 ['mensagem divergente',{current:{...current,temp_data:{provider_message_id:'other'}}}],
 ['snapshot adulterado',{current:{...current,temp_data:{...current.temp_data,atomic_snapshot:{id:'bad'}}}}],
 ['consumido',{current:{...current,temp_data:{...current.temp_data,consumed_at:'now'}}}],
 ['sessao errada',{current:{...current,step:'TX_SETTLE'}}],
 ['valor alterado',{sd:{...sd,amount:999}}],
 ['chave invalida',{params:{...params,p_idempotency_key:''}}],
 ['cliente invalido',{db:{}}],
 ]){const before=calls.length;await assert.rejects(()=>run(opts));assert.equal(calls.length,before,name+' nao pode chamar RPC');console.log('OK:',name)}
for(const [name,response] of [['CAS obsoleto',{data:{applied:false,reason:'STALE_SESSION'},error:null}],['versao divergente',{data:{applied:true,revision:99},error:null}],['erro Postgres',{data:null,error:new Error('Postgres unavailable')}],['resposta vazia',{data:null,error:null}]]){
 await assert.rejects(()=>run({db:{rpc:async()=>response}}));console.log('OK:',name);
}
assert.ok(!w.includes('stageAtomicV2Snapshot('),'staging nao conectado antes de validar E2E');
console.log('R242–R249: persistencia CAS testada; webhook desativado; 13 cenarios PASS');
