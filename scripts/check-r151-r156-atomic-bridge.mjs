import fs from 'node:fs';import assert from 'node:assert/strict';import ts from 'typescript';import vm from 'node:vm';
const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8');
const src=fs.readFileSync('supabase/functions/_shared/atomicBotSingle.ts','utf8');
const sql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026183000_r146_atomic_bot_single_entry.sql','utf8');
const cas=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026150000_r133_bot_session_cas.sql','utf8');
for(const a of ['DFL_BOT_ATOMIC_SINGLE_V1','atomicBotSingle(db,u,phone,sd,acc,cat,params,rpc)','if(atomicMode)'])assert.ok(wh.includes(a),a);
for(const a of ['dfl_bot_session_cas','dfl_bot_record_single_atomic_r146','proposal_id','idempotency_key','consumed_at','CAS perdeu concorrencia','fluxo nao suportado'])assert.ok(src.includes(a),a);
assert.ok(sql.includes('for update;') && sql.includes('public.bot_record_transaction('));
assert.ok(cas.includes('revision = revision + 1'));
const js=ts.transpileModule(src.replace('export async function atomicBotSingle','async function atomicBotSingle')+'\n;globalThis.atomicBotSingle=atomicBotSingle;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const sandbox={globalThis:null,exports:{},Number,String,Set,Error};sandbox.globalThis=sandbox;vm.runInNewContext(js,sandbox,{timeout:2000});
const fn=sandbox.atomicBotSingle;
const base={step:'TX_CAT',revision:4,temp_data:{}};
const u={user_id:'11111111-1111-4111-8111-111111111111'};
const acc={id:'22222222-2222-4222-8222-222222222222'};
const sd={type:'expense',amount:42,description:'Teste',context:'personal'};
const params={p_idempotency_key:'33333333-3333-4333-8333-333333333333',p_date:'2026-10-26'};
function mock(row=structuredClone(base),opts={}) {const calls=[];const db={
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})}),
 rpc:async(name,p)=>{calls.push({name,p});if(name==='dfl_bot_session_cas')return {data:{applied:!opts.stale,revision:5},error:null};if(name==='dfl_bot_record_single_atomic_r146')return {data:{atomic:!opts.untrusted,transaction_id:'tx-id'},error:null};throw Error('RPC inesperada')}
};return {db,calls}}
{
 const x=mock();const result=await fn(x.db,u,'5534999999999',sd,acc,null,params,'bot_record_transaction');
 assert.equal(result.data.atomic,true);assert.deepEqual(x.calls.map(c=>c.name),['dfl_bot_session_cas','dfl_bot_record_single_atomic_r146']);
 assert.equal(x.calls[1].p.p_expected_revision,5);console.log('OK: congela snapshot antes de registrar');
}
{
 const x=mock(undefined,{stale:true});await assert.rejects(fn(x.db,u,'5534999999999',sd,acc,null,params,'bot_record_transaction'),/CAS perdeu/);
 assert.equal(x.calls.length,1);console.log('OK: CAS concorrente impede RPC financeira');
}
{
 const x=mock(undefined,{untrusted:true});await assert.rejects(fn(x.db,u,'5534999999999',sd,acc,null,params,'bot_record_transaction'),/sem comprovacao atomica/);
 console.log('OK: resposta sem marcador atomico rejeitada');
}
{
 const x=mock();await assert.rejects(fn(x.db,u,'5534999999999',{...sd,recurrence:{}},acc,null,params,'bot_record_transaction'),/nao suportado/);
 assert.equal(x.calls.length,0);console.log('OK: recorrencia fora do wrapper');
}
{
 const x=mock({...base,temp_data:{proposal_id:'tx:outro'}});await assert.rejects(fn(x.db,u,'5534999999999',sd,acc,null,params,'bot_record_transaction'),/proposta concorrente/);
 assert.equal(x.calls.length,0);console.log('OK: proposta congelada impede sobrescrita');
}
console.log('R151-R156: testes comportamentais + contratos aprovados; sem teste remoto');
