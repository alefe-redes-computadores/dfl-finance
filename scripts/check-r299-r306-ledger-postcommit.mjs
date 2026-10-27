import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import vm from 'node:vm';
const src=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8');
const a=src.indexOf('/* R291_POSTCOMMIT_VERIFY:');
const b=src.indexOf('let heldReceiptLinked=',a);
assert.ok(a>=0&&b>a);
const block=src.slice(a,b);
assert.ok(block.includes('R299_LEDGER_POSTCOMMIT_VERIFY'));
assert.ok(!block.includes('db.rpc('),'prova nao pode escrever financeiramente');
assert.ok(!block.includes('await save('),'prova nao deve sobrescrever sessao');
assert.ok(!block.includes('await clear('),'prova nao deve apagar sessao');
assert.ok(src.includes('DFL_ATOMIC_V2_NOT_RELEASED'),'V2 precisa continuar bloqueada');
const code=ts.transpileModule('async function check(){'+block+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const base={id:'tx-1',user_id:'u-1',account_id:'a-1',category_id:'c-1',type:'expense',amount:75.2,description:'Fornecedor',context:'dfl',date:'2026-10-27',idempotency_key:'k-1',status:'pending',affects_balance:false};
async function run({row=base,session=true,atomic=true,dbError=null}={}){
 let tables=[];
 const fakeDb={from(table){tables.push(table);const query={select(){return query},eq(){return query},async maybeSingle(){if(table==='bot_sessions')return {error:null,data:session?{step:'TX_SETTLE',temp_data:{consumed_at:'2026-10-27T11:00:00Z',transaction_id:'tx-1',idempotency_key:'k-1'}}:null};if(table==='transactions')return {error:dbError,data:row};throw Error('unexpected table')}};return query}};
 const context={r:{data:atomic?{atomic:true}:{}},sd:{recurrence:false,type:'expense',context:'dfl',amount:75.2,description:'Fornecedor',date:'2026-10-27'},txid:'tx-1',key:'k-1',phone:'fake',u:{user_id:'u-1'},acc:{id:'a-1'},cat:{id:'c-1'},db:fakeDb,Number,String,Math,Error,day:()=> '2026-10-27'};
 await vm.runInNewContext(code+';check()',context,{timeout:3000});return tables;
}
assert.deepEqual(await run(),['bot_sessions','transactions']);
assert.deepEqual(await run({atomic:false}),[]);
for(const [field,value] of Object.entries({user_id:'other',account_id:'other',category_id:'other',type:'income',amount:90,description:'Other',context:'personal',date:'2026-10-26',idempotency_key:'other',status:'invalid',affects_balance:true})){
 await assert.rejects(()=>run({row:{...base,[field]:value}}),/DFL_ATOMIC_POSTCOMMIT_LEDGER_NOT_VERIFIED/);
 console.log('OK: divergencia bloqueada',field);
}
await assert.rejects(()=>run({row:null}),/DFL_ATOMIC_POSTCOMMIT_LEDGER_NOT_VERIFIED/);
await assert.rejects(()=>run({session:false}),/DFL_ATOMIC_POSTCOMMIT_SESSION_NOT_VERIFIED/);
await assert.rejects(()=>run({dbError:new Error('ledger unavailable')}),/ledger unavailable/);
assert.deepEqual(await run({row:{...base,status:'done',affects_balance:true}}),['bot_sessions','transactions']);
console.log('R299-R306: ledger real requerido para sucesso atomico, legado preservado; testes aprovados');
