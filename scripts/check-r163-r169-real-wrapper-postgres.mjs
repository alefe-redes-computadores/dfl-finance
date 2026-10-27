import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

const sql = fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026193000_r157_atomic_bot_recovery.sql','utf8')
const cas = fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026150000_r133_bot_session_cas.sql','utf8')
const webhook = fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
assert.match(sql,/create or replace function public\.dfl_bot_record_single_atomic_r146\(/i)
assert.match(sql,/v_result:=public\.bot_record_transaction\(/i)
assert.match(sql,/DFL_BOT_MISSING_TRANSACTION_ID/i)
assert.ok(webhook.includes('DFL_BOT_ATOMIC_SINGLE_V1'))
const db = new PGlite()
const uid='11111111-1111-4111-8111-111111111111'
const account='22222222-2222-4222-8222-222222222222'
const category='33333333-3333-4333-8333-333333333333'
const key='44444444-4444-4444-8444-444444444444'
const phone='5534999999999'
const date='2026-10-26'
const proposal='proposal:'+key
const base={proposal_id:proposal,user_id:uid,account_id:account,category_id:category,
 type:'expense',amount:42.5,description:'Despesa de teste',context:'personal',date,idempotency_key:key}
const expected='TX_CAT'
let count=0
async function check(name,fn){await fn();count++;console.log('OK:',name)}
async function state(){const r=await db.query('select step,revision,temp_data from public.bot_sessions where phone=$1',[phone]);return r.rows[0]}
async function txCount(){const r=await db.query('select count(*)::int as n from public.r169_ledger');return r.rows[0].n}
async function setupSession(data=base,step=expected,revision=0){
 await db.query('insert into public.bot_sessions(phone,step,temp_data,revision) values ($1,$2,$3::jsonb,$4) on conflict(phone) do update set step=excluded.step,temp_data=excluded.temp_data,revision=excluded.revision',[phone,step,JSON.stringify(data),revision])
}
const args=(override={})=>({
  user:uid,phone,revision:0,step:expected,proposal,account,category,
  type:'expense',amount:42.5,description:'Despesa de teste',context:'personal',key,date,...override
})
const commit=async p=>{const x=args(p); const r=await db.query(`select public.dfl_bot_record_single_atomic_r146(
 $1::uuid,$2::text,$3::bigint,$4::text,$5::text,$6::uuid,$7::uuid,
 $8::text,$9::numeric,$10::text,$11::text,$12::uuid,$13::date) result`,
 [x.user,x.phone,x.revision,x.step,x.proposal,x.account,x.category,
 x.type,x.amount,x.description,x.context,x.key,x.date]);return r.rows[0].result}
try {
 await db.exec(`
 create schema if not exists auth;
 create or replace function auth.role() returns text language sql stable as $$ select 'service_role'::text $$;
 do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
 end $$;
 create table public.bot_sessions(phone text primary key,step text,temp_data jsonb);
 create table public.r169_ledger(id uuid primary key default gen_random_uuid(),
  user_id uuid not null,account_id uuid not null, amount numeric not null check (amount>0),
  idempotency_key uuid unique not null, description text not null);
 create or replace function public.bot_record_transaction(
  p_user_id uuid, p_account_id uuid,p_type text,p_amount numeric,p_description text,p_context text,
  p_category_id uuid default null,p_idempotency_key uuid default null,p_date date default null)
  returns jsonb language plpgsql security definer set search_path='' as $fn$
  declare found_id uuid;
  begin
    if p_description='R169_SIMULATE_LEDGER_FAILURE' then raise exception 'R169_LEDGER_FAILURE'; end if;
    select id into found_id from public.r169_ledger where idempotency_key=p_idempotency_key;
    if found then return jsonb_build_object('transaction_id',found_id,'duplicate',true); end if;
    insert into public.r169_ledger(user_id,account_id,amount,idempotency_key,description)
    values (p_user_id,p_account_id,p_amount,p_idempotency_key,p_description)
    returning id into found_id;
    return jsonb_build_object('transaction_id',found_id,'duplicate',false);
  end;
  $fn$;
 `)
 await db.exec(cas)
 // Executa a DEFINICAO DO WRAPPER real R157 sem substituir seu codigo;
 // somente o motor de lancamento e um mock SQL com mesma assinatura.
 await db.exec(sql)
 await setupSession()
 await check('wrapper real aceita proposta integralmente vinculada',async()=>{
  const result=await commit()
  assert.equal(result.atomic,true)
  assert.ok(result.transaction_id)
  assert.equal(await txCount(),1)
  const s=await state()
  assert.equal(s.step,'TX_SETTLE')
  assert.equal(Number(s.revision),1)
  assert.equal(s.temp_data.transaction_id,result.transaction_id)
  assert.ok(s.temp_data.consumed_at)
 })
 await check('replay nao cria outra transacao',async()=>{
  await assert.rejects(commit(),/DFL_BOT_SESSION_CHANGED|DFL_BOT_ALREADY_CONSUMED|DFL_BOT_STALE_PROPOSAL/)
  assert.equal(await txCount(),1)
 })
 await check('revisao antiga falha sem tocar no ledger',async()=>{
  await setupSession(base,expected,3)
  await assert.rejects(commit({revision:2}),/DFL_BOT_STALE_PROPOSAL/)
  assert.equal(await txCount(),1)
 })
 await check('conta divergente falha sem tocar no ledger',async()=>{
  await setupSession(base)
  await assert.rejects(commit({account:uid}),/DFL_BOT_PROPOSAL_CHANGED/)
  assert.equal(await txCount(),1)
 })
 await check('categoria divergente falha sem tocar no ledger',async()=>{
  await assert.rejects(commit({category:uid}),/DFL_BOT_PROPOSAL_CHANGED/)
  assert.equal(await txCount(),1)
 })
 await check('valor divergente falha sem tocar no ledger',async()=>{
  await assert.rejects(commit({amount:43}),/DFL_BOT_PROPOSAL_CHANGED/)
  assert.equal(await txCount(),1)
 })
 await check('chave divergente falha sem tocar no ledger',async()=>{
  await assert.rejects(commit({key:uid}),/DFL_BOT_PROPOSAL_CHANGED/)
  assert.equal(await txCount(),1)
 })
 await check('falha dentro da RPC financeira preserva sessao',async()=>{
  const failData={...base,description:'R169_SIMULATE_LEDGER_FAILURE',idempotency_key:'55555555-5555-4555-8555-555555555555',proposal_id:'proposal:fail'}
  await setupSession(failData)
  await assert.rejects(commit({description:failData.description,key:failData.idempotency_key,proposal:failData.proposal_id}),/R169_LEDGER_FAILURE/)
  assert.equal((await state()).step,expected)
  assert.equal((await state()).temp_data.consumed_at,undefined)
  assert.equal(await txCount(),1)
 })
 await check('contexto divergente falha',async()=>{
  await setupSession(base)
  await assert.rejects(commit({context:'dfl'}),/DFL_BOT_PROPOSAL_CHANGED/)
  assert.equal(await txCount(),1)
 })
 await check('autorizacao exige etapa correta',async()=>{
  await assert.rejects(commit({step:'TX_CONFIRM'}),/DFL_BOT_SESSION_CHANGED/)
  assert.equal(await txCount(),1)
 })
 console.log(`R163–R169: ${count} testes PostgreSQL isolado aprovados usando wrapper SQL real e ledger simulado.`)
} finally {await db.close()}
