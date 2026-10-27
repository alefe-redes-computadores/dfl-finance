import fs from 'node:fs'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
const sql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026194500_r170_atomic_single_v2.sql','utf8')
const helper=fs.readFileSync('supabase/functions/_shared/atomicBotSingleV2.ts','utf8')
const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
assert.ok(!wh.includes('atomicBotSingleV2'),'v2 nao pode estar ativada por acidente')
assert.ok(!helper.includes("db.rpc('dfl_bot_session_cas'"),'cas separado proibido')
assert.match(sql,/for update;/i)
assert.ok(sql.indexOf('for update;')<sql.indexOf('result:=public.bot_record_transaction'))
const db=new PGlite()
const uid='11111111-1111-4111-8111-111111111111',account='22222222-2222-4222-8222-222222222222',cat='33333333-3333-4333-8333-333333333333',key='44444444-4444-4444-8444-444444444444',phone='5534999999999'
const base={provider_message_id:'message-one',proposal_id:'tx:'+key,user_id:uid,account_id:account,category_id:cat,idempotency_key:key,type:'expense',amount:42.5,description:'Gasto exemplo',context:'personal',date:'2026-10-26'}
let passed=0
const check=async(n,f)=>{await f();console.log('OK:',n);passed++}
const session=async()=> (await db.query('select * from public.bot_sessions where phone=$1',[phone])).rows[0]
const count=async()=>Number((await db.query('select count(*) n from public.r170_transactions')).rows[0].n)
const seed=async(s=base,rev=0,step='TX_CAT')=>db.query('insert into public.bot_sessions(phone,step,temp_data,revision) values($1,$2,$3::jsonb,$4) on conflict(phone) do update set step=excluded.step,temp_data=excluded.temp_data,revision=excluded.revision',[phone,step,JSON.stringify(s),rev])
const run=async(over={})=>{const x={revision:0,step:'TX_CAT',category:cat,account,amount:42.5,description:'Gasto exemplo',context:'personal',key,date:'2026-10-26',...over};return (await db.query(`select public.dfl_bot_commit_single_v2($1::uuid,$2::text,$3::bigint,$4::text,$5::text,$6::uuid,$7::uuid,$8::text,$9::numeric,$10::text,$11::text,$12::uuid,$13::date) v`,[uid,phone,x.revision,x.step,'tx:'+x.key,x.account,x.category,'expense',x.amount,x.description,x.context,x.key,x.date])).rows[0].v}
try{
await db.exec(`create schema if not exists auth;create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role;end if;end $$;
create table public.bot_sessions(phone text primary key,step text,temp_data jsonb,revision bigint not null default 0);
create table public.r170_transactions(id uuid primary key default gen_random_uuid(),user_id uuid,account_id uuid,amount numeric,idempotency_key uuid unique,description text);
create or replace function public.bot_record_transaction(p_user_id uuid,p_account_id uuid,p_type text,p_amount numeric,p_description text,p_context text,p_category_id uuid default null,p_idempotency_key uuid default null,p_date date default null) returns jsonb language plpgsql as $fn$ declare tid uuid;begin
if p_description='R170_FAILURE' then raise exception 'LEDGER_ROLLBACK';end if;
select id into tid from public.r170_transactions where idempotency_key=p_idempotency_key;
if found then return jsonb_build_object('transaction_id',tid,'duplicate',true);end if;
insert into public.r170_transactions(user_id,account_id,amount,idempotency_key,description) values(p_user_id,p_account_id,p_amount,p_idempotency_key,p_description) returning id into tid;
return jsonb_build_object('transaction_id',tid,'duplicate',false);end;$fn$;`)
await db.exec(sql)
await seed()
await check('unica RPC grava e consome versao atomicamente',async()=>{const r=await run();assert.equal(r.atomic,true);assert.ok(r.transaction_id);assert.equal(await count(),1);const s=await session();assert.equal(s.step,'TX_SETTLE');assert.equal(Number(s.revision),1);assert.equal(s.temp_data.transaction_id,r.transaction_id)})
await check('replay antigo rejeitado',async()=>{await assert.rejects(run(),/DFL_BOT_SESSION_CHANGED|DFL_BOT_STALE_PROPOSAL/);assert.equal(await count(),1)})
await seed(base,2)
await check('revisao obsoleta rejeitada',async()=>{await assert.rejects(run(),/DFL_BOT_STALE_PROPOSAL/);assert.equal(await count(),1)})
await seed()
for(const [name,props] of [['valor divergente',{amount:88}],['descricao divergente',{description:'Outra'}],['contexto divergente',{context:'dfl'}]])await check(name,async()=>{await assert.rejects(run(props),/DFL_BOT_PROPOSAL_CHANGED/);assert.equal(await count(),1)})
await check('rollback integral na falha financeira',async()=>{await seed({...base,description:'R170_FAILURE'});await assert.rejects(run({description:'R170_FAILURE'}),/LEDGER_ROLLBACK/);const s=await session();assert.equal(s.step,'TX_CAT');assert.equal(Number(s.revision),0);assert.equal(await count(),1)})
await check('mesma revisao em repeticao rejeitada',async()=>{await seed({...base,provider_message_id:'message-two',proposal_id:'tx:55555555-5555-4555-8555-555555555555',idempotency_key:'55555555-5555-4555-8555-555555555555'},0);const x=await run({key:'55555555-5555-4555-8555-555555555555'});assert.equal(x.atomic,true);await assert.rejects(run({key:'55555555-5555-4555-8555-555555555555'}),/DFL_BOT_SESSION_CHANGED|DFL_BOT_STALE_PROPOSAL/);assert.equal(await count(),2)})
console.log(`R170-R176: ${passed} verificacoes Postgres aprovada(s), ledger de teste. Nao e E2E do schema real.`)
}finally{await db.close()}
