import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const file='supabase/functions/_shared/atomicV2Orchestrator.ts';
const read=p=>fs.readFileSync(p,'utf8');
const source=read(file),webhook=read('supabase/functions/whatsapp-webhook/index.ts');
assert.ok(source.includes('R267_RECOVERY_FINAL'));
assert.ok(webhook.includes('DFL_R369_ROLLOUT_GATE_UNAVAILABLE')&&webhook.includes('const atomicMode=false;'));
assert.ok(!webhook.includes('atomicV2Orchestrator.ts'));
const code=ts.transpileModule(source,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const stub={stageAtomicV2Snapshot:async()=>({revision:2})};
const one={atomicBotSingleV2:async()=>{throw Error('RPC proibida no fluxo de recuperacao')}};
const sess={restoredConsumedSession:(row,result)=>{if(row.step!=='TX_SETTLE'||!row.temp_data?.consumed_at||!row.temp_data?.transaction_id||row.temp_data.transaction_id!==result.transaction_id)throw Error('invalid consumed');return row.temp_data}};
const deps={'./atomicV2Stage.ts':stub,'./atomicBotSingleV2.ts':one,'./atomicV2Session.ts':sess};
const exports={};vm.runInNewContext(code,{exports,require:n=>{assert.ok(Object.hasOwn(deps,n),'Unexpected import '+n);return deps[n]},Error,Number,String,Object},{timeout:3000});
const mod=exports;
const input={u:{user_id:'owner'},phone:'5511999',sd:{provider_message_id:'msg',type:'expense',amount:45,description:'Compra',context:'personal'},acc:{id:'acc'},cat:{id:'cat'},params:{p_idempotency_key:'key',p_date:'2026-10-26'}};
const st={step:'TX_SETTLE',revision:2,temp_data:{transaction_id:'tx',consumed_at:'2026-10-26T10:00:00Z',proposal_id:'tx:key',user_id:'owner',idempotency_key:'key',account_id:'acc',category_id:'cat',type:'expense',amount:45,description:'Compra',context:'personal',date:'2026-10-26'}};
const tx={id:'tx',user_id:'owner',idempotency_key:'key',account_id:'acc',category_id:'cat',type:'expense',amount:45,description:'Compra',context:'personal',date:'2026-10-26',status:'pending',affects_balance:false};
function db(record){let rpc=0,reads=0;const result={from(t){assert.ok(['bot_sessions','transactions'].includes(t));const q={select(){return q},eq(){return q},async maybeSingle(){reads++;return {data:t==='bot_sessions'?st:record,error:null}}};return q;},async rpc(){rpc++;throw Error('No writes allowed')}};return {client:result,counts:()=>({rpc,reads})}}
for(const [name,record,accept] of [
 ['pending sem saldo',tx,true],
 ['done com saldo',{...tx,status:'done',affects_balance:true},true],
 ['pending com saldo',{...tx,affects_balance:true},false],
 ['done sem saldo',{...tx,status:'done',affects_balance:false},false],
 ['transacao ausente',null,false],
 ['outra conta',{...tx,account_id:'other'},false],
 ['outro usuario',{...tx,user_id:'other'},false],
 ['outra chave',{...tx,idempotency_key:'other'},false],
 ['status cancelado',{...tx,status:'cancelled'},false],
 ]){
 const c=db(record),run=()=>mod.verifyAtomicV2Recovery({...input,db:c.client});
 if(accept){const r=await run();assert.equal(r.verified,true);assert.equal(r.ledgerReadOnly,true)}else await assert.rejects(run);
 assert.equal(c.counts().rpc,0,'sem RPC mutavel '+name);
 assert.ok(c.counts().reads>=2);
 console.log('OK:',name);
}
console.log('R267-R274: 9 cenarios de prova do ledger aprovados')
