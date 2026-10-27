import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026220000_r219_bot_atomic_v2_consolidated.sql','utf8');
const pg=new PGlite();
const uid='11111111-1111-4111-8111-111111111111';
const account='22222222-2222-4222-8222-222222222222';
const cat='33333333-3333-4333-8333-333333333333';
const key='44444444-4444-4444-8444-444444444444';
const phone='5534999999999';
const proposal='tx:'+key;
const txid='55555555-5555-4555-8555-555555555555';
const snapshot={provider_message_id:'msg-e2e-1',proposal_id:proposal,user_id:uid,account_id:account,category_id:cat,idempotency_key:key,type:'expense',amount:75.2,description:'Teste isolamento',context:'dfl',date:'2026-10-27'};
const args=[uid,phone,0,'TX_CONFIRM',proposal,account,cat,'expense',75.2,'Teste isolamento','dfl',key,'2026-10-27'];
const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');
const call='select public.dfl_bot_commit_single_v2('+placeholders+') as result';
const callArgs=async (a=args)=> (await pg.query(call,a)).rows[0].result;
async function reset(data=snapshot,rev=0){
 await pg.query('truncate public.test_record_log');
 await pg.query('delete from public.bot_sessions');
 await pg.query('insert into public.bot_sessions(phone,step,temp_data,revision) values ($1,$2,$3::jsonb,$4)',[phone,'TX_CONFIRM',JSON.stringify(data),rev]);
}
const events=[];
async function check(name,fn){await fn();events.push(name);console.log('OK:',name)}
try{
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create schema if not exists auth;
 create function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
 create table public.bot_sessions(phone text primary key,step text,temp_data jsonb);
 create table public.test_record_log(id bigserial primary key, idempotency_key uuid, amount numeric);
 create function public.bot_record_transaction(p_user_id uuid,p_account_id uuid,p_type text,p_amount numeric,p_description text,p_context text,p_category_id uuid default null,p_idempotency_key uuid default null,p_date date default null) returns jsonb language plpgsql as $func$
 begin
  if p_description='FORCE_FAILURE' then raise exception 'TEST_FINANCIAL_FAILURE';end if;
  insert into public.test_record_log(idempotency_key,amount) values(p_idempotency_key,p_amount);
  return jsonb_build_object('transaction_id','55555555-5555-4555-8555-555555555555'::uuid);
 end $func$;`);
 await check('R219: SQL consolidado instala CAS e wrapper',async()=>{
   await pg.exec(sql);
   const r=await pg.query("select count(*)::int as count from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in ('dfl_bot_session_cas','dfl_bot_commit_single_v2')");
   assert.equal(r.rows[0].count,2);
 });
 await check('commit atomico gera um registro e consome sessao',async()=>{
   await reset();const r=await callArgs();assert.equal(r.atomic,true);
   const s=(await pg.query('select step,revision,temp_data from public.bot_sessions')).rows[0];
   assert.equal(s.step,'TX_SETTLE');assert.equal(Number(s.revision),1);
   assert.equal(s.temp_data.transaction_id,txid);assert.ok(s.temp_data.consumed_at);
   const n=(await pg.query('select count(*)::int as n from public.test_record_log')).rows[0].n;assert.equal(n,1);
 });
 await check('replay nao produz segundo registro',async()=>{
   await assert.rejects(()=>callArgs(),/DFL_BOT_SESSION_CHANGED|DFL_BOT_ALREADY_CONSUMED|DFL_BOT_STALE_PROPOSAL/);
   const n=(await pg.query('select count(*)::int as n from public.test_record_log')).rows[0].n;assert.equal(n,1);
 });
 await check('snapshot adulterado bloqueado sem escrita',async()=>{
   await reset({...snapshot,amount:70});await assert.rejects(()=>callArgs(),/DFL_BOT_PROPOSAL_CHANGED/);
   const n=(await pg.query('select count(*)::int as n from public.test_record_log')).rows[0].n;assert.equal(n,0);
 });
 await check('snapshot incompleto bloqueado',async()=>{
   const invalid={...snapshot};delete invalid.account_id;
   await reset(invalid);await assert.rejects(()=>callArgs(),/DFL_BOT_INCOMPLETE_SNAPSHOT/);
 });
 await check('revisao obsoleta bloqueada',async()=>{
   await reset(snapshot,2);await assert.rejects(()=>callArgs(),/DFL_BOT_STALE_PROPOSAL/);
 });
 await check('falha financeira reverte consumo da sessao',async()=>{
   await reset({...snapshot,description:'FORCE_FAILURE'});
   const a=[...args];a[9]='FORCE_FAILURE';
   await assert.rejects(()=>callArgs(a),/TEST_FINANCIAL_FAILURE/);
   const s=(await pg.query('select step,revision,temp_data from public.bot_sessions')).rows[0];
   assert.equal(s.step,'TX_CONFIRM');assert.equal(Number(s.revision),0);assert.equal(s.temp_data.consumed_at,undefined);
   const n=(await pg.query('select count(*)::int as n from public.test_record_log')).rows[0].n;assert.equal(n,0);
 });
 await check('apos falha, tentativa valida registra uma vez',async()=>{
   await reset();const r=await callArgs();assert.equal(r.atomic,true);
   const n=(await pg.query('select count(*)::int as n from public.test_record_log')).rows[0].n;assert.equal(n,1);
 });
 await check('execucao fica restrita ao service_role',async()=>{
   const r=await pg.query("select has_function_privilege('anon','public.dfl_bot_commit_single_v2(uuid,text,bigint,text,text,uuid,uuid,text,numeric,text,text,uuid,date)','execute') as anon,has_function_privilege('authenticated','public.dfl_bot_commit_single_v2(uuid,text,bigint,text,text,uuid,uuid,text,numeric,text,text,uuid,date)','execute') as auth");
   assert.equal(r.rows[0].anon,false);assert.equal(r.rows[0].auth,false);
 });
 console.log('R307–R314: '+events.length+' provas PostgreSQL PASS — ledger simulado; E2E real pendente');
}finally{await pg.close()}
