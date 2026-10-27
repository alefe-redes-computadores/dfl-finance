import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const oldSql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026220000_r219_bot_atomic_v2_consolidated.sql','utf8');
const fix=fs.readFileSync('docs/sql-candidates/r347-r349-v2-integrity.sql','utf8');
const bundle=fs.readFileSync('docs/sql-candidates/r351-v2-release-bundle.sql','utf8');
const rpcTest=fs.readFileSync('scripts/check-r315-r322-real-financial-rpc.mjs','utf8');
const actual=rpcTest.match(/const actualRpc=`([\s\S]*?)`;/);
assert.ok(actual?.[1], 'nao foi possivel recuperar definicao auditada da RPC financeira');
assert.ok(fix.includes('DFL_BOT_IDEMPOTENCY_PAYLOAD_MISMATCH'));
assert.ok(fix.includes('DFL_BOT_FROZEN_OVERWRITE_DENIED'));
assert.ok(fix.includes('create trigger dfl_bot_v2_frozen_session_guard_trg'));
const pg=new PGlite();
const U='11111111-1111-4111-8111-111111111111';
const A='22222222-2222-4222-8222-222222222222';
const C='33333333-3333-4333-8333-333333333333';
const K='44444444-4444-4444-8444-444444444444';
const P='5534999999999';
const original={provider_message_id:'message-received-one',proposal_id:'tx:'+K,user_id:U,account_id:A,category_id:C,idempotency_key:K,type:'expense',amount:75.2,description:'Teste isolado',context:'dfl',date:'2026-10-27'};
const args=[U,P,1,'TX_CONFIRM','tx:'+K,A,C,'expense',75.2,'Teste isolado','dfl',K,'2026-10-27'];
const one=async(query,params=[]) => (await pg.query(query,params)).rows[0];
const session=()=>one('select step,revision,temp_data from public.bot_sessions where phone=$1',[P]);
const number=async(query)=>Number((await one(query)).n);
const ledgerCount=()=>number('select count(*) n from public.transactions');
const call=(a=args)=>pg.query('select public.dfl_bot_commit_single_v2('+a.map((_,i)=>'$'+(i+1)).join(',')+') v',a).then(x=>x.rows[0].v);
const store=async(o=original)=>{
 await pg.query('delete from public.bot_sessions');
 await pg.query('insert into public.bot_sessions(phone,step,temp_data,revision) values ($1,\'TX_CONFIRM\',$2::jsonb,0)',[P,JSON.stringify(o)]);
};
const freeze=async(o=original)=>{
 const data={...o,atomic_snapshot:o};
 const r=await pg.query('select public.dfl_bot_session_cas($1,$2,$3,$4,$5::jsonb) v',[P,0,'TX_CONFIRM','TX_CONFIRM',JSON.stringify(data)]);
 assert.equal(r.rows[0].v.applied,true);
 assert.equal(r.rows[0].v.revision,1);
};
let passed=0;
const test=async(n,fn)=>{await fn();console.log('OK:',n);passed++};
try{
 await pg.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema auth;
 create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
 create table public.accounts(id uuid primary key,user_id uuid,context text,is_archived boolean default false,name text,balance numeric not null default 900);
 create table public.categories(id uuid primary key,user_id uuid,context text,type text);
 create table public.transactions(id uuid primary key default gen_random_uuid(),user_id uuid,account_id uuid,category_id uuid,type text,amount numeric,description text,date date,status text,context text,source text,affects_balance boolean,sync_status text,sync_attempts integer,idempotency_key uuid unique,created_at timestamptz,updated_at timestamptz);
 create table public.bot_sessions(phone text primary key,step text,temp_data jsonb);
 insert into public.accounts(id,user_id,context,is_archived,name,balance) values('${A}','${U}','dfl',false,'Teste',900);
 insert into public.categories(id,user_id,context,type) values('${C}','${U}','dfl','expense');`);
 await pg.query("select set_config('request.jwt.claim.role','service_role',false)");
 await pg.exec(actual[1]);
 await pg.exec(bundle);
 await test('original R219 + hardening compila sem alterar a RPC financeira',async()=>{
  const row=await one("select count(*) n from pg_trigger where tgname='dfl_bot_v2_frozen_session_guard_trg' and not tgisinternal");assert.equal(Number(row.n),1);
 });
 await test('sessao comum permite update legado normal',async()=>{
  await store();await pg.query("update public.bot_sessions set step='TX_CAT' where phone=$1",[P]);assert.equal((await session()).step,'TX_CAT');
 });
 await test('preparacao CAS congela sessao sem mudar o ledger',async()=>{
  await store();await freeze();assert.equal(Number((await session()).revision),1);assert.equal(await ledgerCount(),0);
 });
 await test('upsert legado apos snapshot congelado bloqueado',async()=>{
  await assert.rejects(()=>pg.query("insert into public.bot_sessions(phone,step,temp_data) values ($1,'TX_CAT','{}'::jsonb) on conflict(phone) do update set step=excluded.step,temp_data=excluded.temp_data",[P]),/DFL_BOT_FROZEN_OVERWRITE_DENIED/);
  const s=await session();assert.equal(s.step,'TX_CONFIRM');assert.equal(Number(s.revision),1);
 });
 await test('cancelamento sem ledger libera rascunho congelado',async()=>{
  await pg.query('delete from public.bot_sessions where phone=$1',[P]);
  assert.equal(await number('select count(*) n from public.bot_sessions'),0);
  await store();await freeze();
 });
 await test('cancelamento COM registro correspondente no ledger e bloqueado',async()=>{
  await pg.query(`insert into public.transactions(user_id,account_id,category_id,type,amount,description,date,status,context,source,affects_balance,idempotency_key)
   values ($1,$2,$3,'expense',75.2,'Teste isolado','2026-10-27','pending','dfl','whatsapp',false,$4)`,[U,A,C,K]);
  await assert.rejects(()=>pg.query('delete from public.bot_sessions where phone=$1',[P]),/DFL_BOT_FROZEN_TRANSACTION_EXISTS/);
  assert.equal(await number('select count(*) n from public.bot_sessions'),1);
  await pg.query('delete from public.transactions where idempotency_key=$1',[K]);
 });
 await test('cancelamento sem identificador financeiro valido falha fechado',async()=>{
  await pg.query("update public.bot_sessions set temp_data=jsonb_set(temp_data,'{idempotency_key}','null'::jsonb) where phone=$1",[P]).then(()=>{throw Error('edicao congelada nao poderia passar')},()=>{});
  assert.ok((await session()).temp_data.idempotency_key);
 });
 await test('CAS concorrente com mesma revisao obsoleta',async()=>{
  const r=await pg.query('select public.dfl_bot_session_cas($1,$2,$3,$4,$5::jsonb) v',[P,0,'TX_CONFIRM','TX_CONFIRM',JSON.stringify(original)]);
  assert.equal(r.rows[0].v.applied,false);
 });
 await test('R351: consumo ficticio sem ledger e negado',async()=>{
  const ghost='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  await assert.rejects(()=>pg.query(`update public.bot_sessions set step='TX_SETTLE',revision=revision+1,
   temp_data=temp_data || jsonb_build_object('transaction_id',$1::text,'consumed_at',now()::text)
   where phone=$2`,[ghost,P]),/DFL_BOT_CONSUMPTION_LEDGER_MISMATCH/);
  assert.equal((await session()).step,'TX_CONFIRM');assert.equal(await ledgerCount(),0);
 });
 await test('R351: ledger de outro payload nao comprova consumo',async()=>{
  const wrong='55555555-5555-4555-8555-555555555555';
  const r=await pg.query(`insert into public.transactions(user_id,account_id,category_id,type,amount,description,date,status,context,source,affects_balance,idempotency_key)
   values ($1,$2,$3,'expense',9,'Outro valor','2026-10-27','pending','dfl','whatsapp',false,$4) returning id`,[U,A,C,wrong]);
  await assert.rejects(()=>pg.query(`update public.bot_sessions set step='TX_SETTLE',revision=revision+1,
   temp_data=temp_data || jsonb_build_object('transaction_id',$1::text,'consumed_at',now()::text)
   where phone=$2`,[r.rows[0].id,P]),/DFL_BOT_CONSUMPTION_LEDGER_MISMATCH/);
  assert.equal((await session()).step,'TX_CONFIRM');
  await pg.query('delete from public.transactions where id=$1',[r.rows[0].id]);
 });
 await test('R351: valor e conta congelados nao podem ser trocados',async()=>{
  await assert.rejects(()=>pg.query(`update public.bot_sessions set temp_data=jsonb_set(temp_data,'{amount}','90'::jsonb) where phone=$1`,[P]),/DFL_BOT_FROZEN_OVERWRITE_DENIED/);
  await assert.rejects(()=>pg.query(`update public.bot_sessions set temp_data=jsonb_set(temp_data,'{account_id}',to_jsonb($1::text)) where phone=$2`,[C,P]),/DFL_BOT_FROZEN_OVERWRITE_DENIED/);
  assert.equal((await session()).temp_data.amount,75.2);
 });
 await test('R351: snapshot divergente do root e rejeitado',async()=>{
  await assert.rejects(()=>pg.query(`update public.bot_sessions set temp_data=jsonb_set(temp_data,'{atomic_snapshot,amount}','90'::jsonb) where phone=$1`,[P]),/DFL_BOT_FROZEN_OVERWRITE_DENIED|DFL_BOT_FROZEN_SNAPSHOT_MISMATCH/);
 });
 await test('commit registra pendente, preserva saldo e consome',async()=>{
  const r=await call();assert.equal(r.atomic,true);assert.ok(r.transaction_id);
  const s=await session();assert.equal(s.step,'TX_SETTLE');assert.ok(s.temp_data.consumed_at);assert.ok(s.temp_data.transaction_id);
  assert.equal(await ledgerCount(),1);const row=await one('select status,affects_balance,source from public.transactions');
  assert.equal(row.status,'pending');assert.equal(row.affects_balance,false);assert.equal(row.source,'whatsapp');
  assert.equal(Number((await one('select balance from public.accounts')).balance),900);
 });
 await test('nao aceita sobrescrever consumed_at por save legado',async()=>{
  await assert.rejects(()=>pg.query("update public.bot_sessions set step='TX_SETTLE',temp_data='{}'::jsonb where phone=$1",[P]),/DFL_BOT_FROZEN_OVERWRITE_DENIED|DFL_BOT_CONSUMED_OVERWRITE_DENIED/);
  assert.ok((await session()).temp_data.consumed_at);
 });
 await test('nao permite segundo commit da mesma revisao',async()=>{
  await assert.rejects(()=>call(),/DFL_BOT_SESSION_CHANGED|DFL_BOT_STALE_PROPOSAL/);assert.equal(await ledgerCount(),1);
 });
 await test('mismatch de idempotencia rejeitado sem consumir autorizacao',async()=>{
  await pg.query('delete from public.bot_sessions');
  await pg.query('update public.transactions set amount=999 where idempotency_key=$1',[K]);
  await store();await freeze();
  await assert.rejects(()=>call(),/DFL_BOT_IDEMPOTENCY_PAYLOAD_MISMATCH/);
  assert.equal((await session()).step,'TX_CONFIRM');assert.equal((await session()).temp_data.consumed_at,undefined);
  assert.equal(await ledgerCount(),1);
 });
 await test('duplicate IDENTICO pode consumir versao sem novo lancamento',async()=>{
  await pg.query('update public.transactions set amount=75.2 where idempotency_key=$1',[K]);
  const x=await call();assert.equal(x.atomic,true);assert.equal(x.duplicate,true);assert.equal(await ledgerCount(),1);
 });
 await test('apos commit exclusao legitima de sessao consumida e permitida',async()=>{
  await pg.query('delete from public.bot_sessions where phone=$1',[P]);assert.equal(await number('select count(*) n from public.bot_sessions'),0);
 });
 console.log('R351: '+passed+' cenarios PostgreSQL (fixture auth + RPC real auditada) aprovados.');
}finally{await pg.close()}
