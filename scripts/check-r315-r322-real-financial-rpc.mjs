import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026220000_r219_bot_atomic_v2_consolidated.sql','utf8');
// Definição da função consultada no DFL - Finance em 27/10/2026;
// esta prova NÃO faz chamada ao Supabase nem utiliza dados financeiros reais.
const actualRpc=`
create or replace function public.bot_record_transaction(
 p_user_id uuid,p_account_id uuid,p_type text,p_amount numeric,p_description text,
 p_context text,p_category_id uuid default null,p_idempotency_key uuid default null,p_date date default null)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
 v_account public.accounts%rowtype;
 v_category public.categories%rowtype;
 v_existing public.transactions%rowtype;
 v_tx public.transactions%rowtype;
 v_date date:=coalesce(p_date,timezone('America/Sao_Paulo',now())::date);
begin
 if p_user_id is null then raise exception 'Usuário não identificado'; end if;
 if p_type not in ('income','expense') then raise exception 'Tipo inválido'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'Valor inválido'; end if;
 if p_context not in ('dfl','personal') then raise exception 'Contexto inválido'; end if;
 if p_idempotency_key is not null then
   select * into v_existing from public.transactions where user_id=p_user_id and idempotency_key=p_idempotency_key limit 1;
   if found then return jsonb_build_object('transaction_id',v_existing.id,'duplicate',true,'account_id',v_existing.account_id,'review_required',v_existing.status='pending' and coalesce(v_existing.affects_balance,false)=false); end if;
 end if;
 select * into v_account from public.accounts where id=p_account_id and user_id=p_user_id and coalesce(is_archived,false)=false;
 if not found then raise exception 'Conta não encontrada'; end if;
 if coalesce(v_account.context,'dfl')<>p_context then raise exception 'Conta não pertence ao contexto informado'; end if;
 if p_category_id is not null then
   select * into v_category from public.categories where id=p_category_id and user_id=p_user_id;
   if not found then raise exception 'Categoria não encontrada'; end if;
   if v_category.context<>p_context then raise exception 'Categoria não pertence ao contexto informado'; end if;
   if v_category.type<>p_type then raise exception 'Categoria incompatível com o tipo da transação'; end if;
 end if;
 insert into public.transactions(user_id,account_id,category_id,type,amount,description,date,status,context,source,affects_balance,sync_status,sync_attempts,idempotency_key,created_at,updated_at)
 values(p_user_id,p_account_id,p_category_id,p_type,p_amount,nullif(trim(coalesce(p_description,'')),''),v_date,'pending',p_context,'whatsapp',false,'synced',0,p_idempotency_key,now(),now()) returning * into v_tx;
 return jsonb_build_object('transaction_id',v_tx.id,'duplicate',false,'account_id',v_account.id,'account_name',v_account.name,'review_required',true,'balance_unchanged',true);
end;
$function$;`;
const pg=new PGlite();
const U='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',K='44444444-4444-4444-8444-444444444444';
const phone='5534999999999',proposal='tx:'+K;
const snap={provider_message_id:'msg-real-1',proposal_id:proposal,user_id:U,account_id:A,category_id:C,idempotency_key:K,type:'expense',amount:75.2,description:'Teste isolado',context:'dfl',date:'2026-10-27'};
const args=[U,phone,0,'TX_CONFIRM',proposal,A,C,'expense',75.2,'Teste isolado','dfl',K,'2026-10-27'];
const call=async a=>(await pg.query('select public.dfl_bot_commit_single_v2('+args.map((_,i)=>'$'+(i+1)).join(',')+') as result',a||args)).rows[0].result;
const row=async q=>(await pg.query(q)).rows[0];
const seed=async (data=snap,revision=0)=>{
 await pg.query('delete from public.bot_sessions');await pg.query('delete from public.transactions');
 await pg.query('insert into public.bot_sessions(phone,step,temp_data,revision) values ($1,$2,$3::jsonb,$4)',[phone,'TX_CONFIRM',JSON.stringify(data),revision]);
};
let count=0;
const check=async(name,run)=>{await run();console.log('OK:',name);count++};
try{
 await pg.exec(`create role anon;create role authenticated;create role service_role;
 create table public.accounts(id uuid primary key,user_id uuid,context text,is_archived boolean default false,name text,balance numeric not null default 900);
 create table public.categories(id uuid primary key,user_id uuid,context text,type text);
 create table public.transactions(id uuid primary key default gen_random_uuid(),user_id uuid,account_id uuid,category_id uuid,type text,amount numeric,description text,date date,status text,context text,source text,affects_balance boolean,sync_status text,sync_attempts integer,idempotency_key uuid unique,created_at timestamptz,updated_at timestamptz);
 create table public.bot_sessions(phone text primary key,step text,temp_data jsonb);
 insert into public.accounts(id,user_id,context,is_archived,name,balance) values('${A}','${U}','dfl',false,'Teste',900);
 insert into public.categories(id,user_id,context,type) values('${C}','${U}','dfl','expense');`);
 // PGlite puro nao fornece o schema auth do Supabase. Simular SOMENTE a API de identidade,
 // lendo uma claim configurada explicitamente no banco de teste; nunca modificar SQL real.
 await pg.exec(`create schema auth;
   create function auth.role() returns text language sql stable as
   $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;`);
 await pg.query("select set_config('request.jwt.claim.role','service_role',false)");
 await check('fixture auth reproduz identidade service_role sem alterar RPC',async()=>{
   assert.equal((await row('select auth.role() as role')).role,'service_role');
 });
 await check('função financeira real e SQL consolidado compilam',async()=>{await pg.exec(actualRpc);await pg.exec(sql)});
 await check('registro pendente sem mexer no saldo',async()=>{
  await seed();const r=await call();assert.equal(r.atomic,true);
  const tx=await row('select status,affects_balance,source,amount,account_id,category_id,idempotency_key from public.transactions');
  assert.equal(tx.status,'pending');assert.equal(tx.affects_balance,false);assert.equal(tx.source,'whatsapp');
  assert.equal(Number(tx.amount),75.2);assert.equal(tx.account_id,A);assert.equal(tx.category_id,C);assert.equal(tx.idempotency_key,K);
  assert.equal(Number((await row('select balance from public.accounts')).balance),900);
  const ss=await row('select step,revision,temp_data from public.bot_sessions');
  assert.equal(ss.step,'TX_SETTLE');assert.equal(Number(ss.revision),1);assert.ok(ss.temp_data.consumed_at);
  assert.ok(ss.temp_data.transaction_id);
 });
 await check('replay bloqueado sem segundo lançamento',async()=>{
  await assert.rejects(()=>call(),/DFL_BOT_SESSION_CHANGED|DFL_BOT_ALREADY_CONSUMED|DFL_BOT_STALE_PROPOSAL/);
  assert.equal(Number((await row('select count(*) as n from public.transactions')).n),1)
 });
 await check('alteração de snapshot não registra',async()=>{
  await seed({...snap,amount:70});await assert.rejects(()=>call(),/DFL_BOT_PROPOSAL_CHANGED/);
  assert.equal(Number((await row('select count(*) as n from public.transactions')).n),0)
 });
 await check('revisão obsoleta não registra',async()=>{
  await seed(snap,4);await assert.rejects(()=>call(),/DFL_BOT_STALE_PROPOSAL/);
  assert.equal(Number((await row('select count(*) as n from public.transactions')).n),0)
 });
 await check('categoria incompatível causa rollback integral',async()=>{
  await seed();await pg.query("update public.categories set type='income'");
  await assert.rejects(()=>call(),/Categoria incompatível/);
  assert.equal(Number((await row('select count(*) as n from public.transactions')).n),0);
  const s=await row('select step,revision,temp_data from public.bot_sessions');
  assert.equal(s.step,'TX_CONFIRM');assert.equal(Number(s.revision),0);assert.equal(s.temp_data.consumed_at,undefined);
  await pg.query("update public.categories set type='expense'");
 });
 await check('após falha real, nova tentativa registra corretamente',async()=>{
  const result=await call();assert.equal(result.atomic,true);
  assert.equal(Number((await row('select count(*) as n from public.transactions')).n),1);
 });
 await check('conta de outro contexto é rejeitada e não grava',async()=>{
  await seed();await pg.query("update public.accounts set context='personal'");
  await assert.rejects(()=>call(),/Conta não pertence ao contexto/);
  assert.equal(Number((await row('select count(*) as n from public.transactions')).n),0);
  assert.equal(Number((await row('select balance from public.accounts')).balance),900);
  await pg.query("update public.accounts set context='dfl'");
 });
 await check('função atômica restrita a service_role',async()=>{
  const q="select has_function_privilege('anon','public.dfl_bot_commit_single_v2(uuid,text,bigint,text,text,uuid,uuid,text,numeric,text,text,uuid,date)','execute') as anon,has_function_privilege('authenticated','public.dfl_bot_commit_single_v2(uuid,text,bigint,text,text,uuid,uuid,text,numeric,text,text,uuid,date)','execute') as auth";
  const x=await row(q);assert.equal(x.anon,false);assert.equal(x.auth,false);
 });
 console.log('R315-R322 R2 APROVADO: '+count+' verificações, função financeira real, PostgreSQL isolado');
}finally{await pg.close()}
