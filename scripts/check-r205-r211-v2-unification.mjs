import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';import vm from 'node:vm';
const source=fs.readFileSync('supabase/functions/_shared/atomicBotV2Bridge.ts','utf8');
const helper=fs.readFileSync('supabase/functions/_shared/atomicBotSingleV2.ts','utf8');
const webhook=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8');
for(const [name,s] of [['bridge',source],['helper',helper]]){const sf=ts.createSourceFile(name+'.ts',s,ts.ScriptTarget.Latest,true);assert.equal(sf.parseDiagnostics.length,0,name+' parsing');}
const out=ts.transpileModule(source.replace(/^export /gm,'')+'\n;globalThis.R205={freezeAtomicSnapshot,sameAtomicSnapshot}',{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
const context={globalThis:{},Number,String,Object,Error};vm.runInNewContext(out,context,{timeout:1500});
const {freezeAtomicSnapshot,sameAtomicSnapshot}=context.globalThis.R205;
const k='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';const acc={id:'account'},cat={id:'cat'},u={user_id:'user'},sd={provider_message_id:'original-provider-message',type:'expense',amount:42.5,description:'Compra',context:'personal',date:'2026-10-26'};
const params={p_idempotency_key:k,p_account_id:acc.id,p_category_id:cat.id,p_type:sd.type,p_amount:sd.amount,p_description:sd.description,p_context:sd.context,p_date:sd.date};
const good=freezeAtomicSnapshot(u,sd,acc,cat,params);assert.equal(good.proposal_id,'tx:'+k);assert.equal(good.category_id,cat.id);assert.equal(sameAtomicSnapshot(good,good),true);
for(const field of ['proposal_id','user_id','account_id','category_id','idempotency_key','type','amount','description','context','date','provider_message_id']){const bad={...good,[field]:field==='amount'?99:'adulterated'};assert.equal(sameAtomicSnapshot(bad,good),false,'tamper '+field);const missing={...good};delete missing[field];assert.equal(sameAtomicSnapshot(missing,good),false,'missing '+field);}
for(const scenario of [()=>freezeAtomicSnapshot(u,{...sd,amount:0},acc,cat,params),()=>freezeAtomicSnapshot(u,sd,acc,cat,{...params,p_amount:99}),()=>freezeAtomicSnapshot(u,{...sd,provider_message_id:null},acc,cat,params),()=>freezeAtomicSnapshot(u,sd,acc,cat,{...params,p_category_id:'wrong'})])assert.throws(scenario,/DFL_V2_SNAPSHOT/);
assert.ok(helper.includes("fail('proposta financeira incompleta ou divergente')"));assert.ok(!webhook.includes('atomicBotSingleV2.ts'),'V2 permanece isolada');
// R227-R234: uma flag mencionada somente num guard que sempre rejeita nao ativa a V2.
const releaseGuard=webhook.includes('R227_R234_UNSAFE_MODE_GUARD')
  && webhook.includes('throw new Error("DFL_ATOMIC_V2_NOT_RELEASED")')
  && webhook.includes('const atomicMode=false;');
assert.ok(releaseGuard || !webhook.includes('DFL_BOT_ATOMIC_V2_ENABLED'),'nenhuma ativacao remota');
assert.ok(!webhook.includes("import { atomicBotSingleV2 }"),'sem importacao executavel da V2');
assert.ok(!webhook.includes('atomicBotSingleV2(db,'),'sem chamada executavel da V2');
console.log('R205-R211: 31 verificacoes de integridade de proposta e ativacao PASS');
