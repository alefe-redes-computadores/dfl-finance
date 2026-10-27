import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
function load(file,dependencies){
 const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:name=>{assert.ok(Object.hasOwn(dependencies,name),'import unexpected '+name);return dependencies[name]},Error,Number,String,Object},{timeout:2500});return exports;
}
const stage={stageAtomicV2Snapshot:async()=>({revision:2})};
const atomic={atomicBotSingleV2:async()=>({data:{transaction_id:'tx'},error:null})};
const session={restoredConsumedSession:(row,result)=>{if(row.step!=='TX_SETTLE'||!row.temp_data?.consumed_at||!row.temp_data.transaction_id||row.temp_data.transaction_id!==result.transaction_id)throw Error('invalid consumed');return row.temp_data}};
const mod=load('supabase/functions/_shared/atomicV2Orchestrator.ts',{'./atomicV2Stage.ts':stage,'./atomicBotSingleV2.ts':atomic,'./atomicV2Session.ts':session});
const input={u:{user_id:'owner'},phone:'5511999',sd:{provider_message_id:'msg',type:'expense',amount:45,description:'Compra',context:'personal'},acc:{id:'acc'},cat:{id:'cat'},params:{p_idempotency_key:'key',p_date:'2026-10-26'}};
const st={step:'TX_SETTLE',revision:2,temp_data:{transaction_id:'tx',consumed_at:'2026-10-26T10:00:00Z',proposal_id:'tx:key',user_id:'owner',idempotency_key:'key',account_id:'acc',category_id:'cat',type:'expense',amount:45,description:'Compra',context:'personal',date:'2026-10-26'}};
const tx={id:'tx',user_id:'owner',idempotency_key:'key',account_id:'acc',category_id:'cat',type:'expense',amount:45,description:'Compra',context:'personal',date:'2026-10-26',status:'pending',affects_balance:false};
function db(sessionRow=st,transaction=tx){let reads=[];const db={from(table){assert.ok(['bot_sessions','transactions'].includes(table));let q={select(){return q},eq(field,value){reads.push({table,field,value});return q},async maybeSingle(){return{data:table==='bot_sessions'?sessionRow:transaction,error:null}}};return q},rpc:async()=>{throw Error('RPC proibida na recuperacao')}};return{db,reads}}
const verified=db();const result=await mod.verifyAtomicV2Recovery({...input,db:verified.db});assert.equal(result.verified,true);assert.equal(result.status,'pending');assert.equal(result.transaction_id,'tx');assert.ok(verified.reads.some(x=>x.table==='transactions'&&x.field==='user_id'&&x.value==='owner'));console.log('OK: prova de ledger, somente leitura');
for(const [name,sessionRow,transaction] of [
 ['sem transacao',st,null],['transacao de outro usuario',st,{...tx,user_id:'other'}],
 ['transacao de outra conta',st,{...tx,account_id:'other'}],['transacao de outro valor',st,{...tx,amount:44}],
 ['transacao sem categoria',st,{...tx,category_id:null}],['transacao em outro status',st,{...tx,status:'cancelled'}],
 ['sessao com chave diferente',{...st,temp_data:{...st.temp_data,idempotency_key:'other'}},tx],
 ['sessao com valor diferente',{...st,temp_data:{...st.temp_data,amount:50}},tx],
 ['sessao nao consumida',{...st,temp_data:{...st.temp_data,consumed_at:null}},tx]
]){
 const x=db(sessionRow,transaction);await assert.rejects(()=>mod.verifyAtomicV2Recovery({...input,db:x.db}),undefined,name);console.log('OK: recusa',name)
}
const src=read('supabase/functions/_shared/atomicV2Orchestrator.ts');assert.ok(src.includes('R259_LEDGER_PROOF'));assert.ok(!src.includes("db.rpc('bot_record_transaction'"));assert.ok(read('supabase/functions/whatsapp-webhook/index.ts').includes('const atomicMode=false;'));
console.log('R259-R266: recuperacao com verificacao financeira e bloqueio V2 PASS')
