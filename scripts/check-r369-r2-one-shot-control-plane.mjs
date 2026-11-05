import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

// R361: data-local only. Uses in-memory PostgreSQL, never Supabase production.
const candidate=fs.readFileSync('supabase/functions/whatsapp-webhook/index.r369-r2-one-shot-off.ts','utf8');
const sql=fs.readFileSync('docs/sql-candidates/r366-v2-canary-strict-immutable-CANDIDATE.sql','utf8');
const r369Sql=fs.readFileSync('docs/sql-candidates/r369-r2-v2-single-use-rollout-OFF-CANDIDATE.sql','utf8');
const legacy=fs.readFileSync('docs/sql-candidates/r351-v2-release-bundle.sql','utf8');
// R369 R2 regression: deferred FK queues trigger checks during INSERT.
// The table must be fully configured before seeding its initial OFF row.
const r369Seed='insert into public.dfl_bot_v2_rollout_gate (singleton,enabled) values (true,false);';
assert.equal(r369Sql.split(r369Seed).length,2);
assert.ok(r369Sql.indexOf(r369Seed)>r369Sql.lastIndexOf('create trigger '));
assert.doesNotMatch(r369Sql.slice(r369Sql.indexOf(r369Seed)), /\b(?:alter|create|drop)\s+(?:table|trigger|function|index)\b/i);

const rpcTest=fs.readFileSync('scripts/check-r315-r322-real-financial-rpc.mjs','utf8');
const baseRpc=rpcTest.match(/const actualRpc=`([\s\S]*?)`;/)?.[1];
assert.ok(baseRpc,'RPC real de teste R315-R322 indisponivel');
const syntax=ts.transpileModule(candidate,{fileName:'index.r362-canary-off.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
assert.deepEqual((syntax.diagnostics||[]).map(d=>d.messageText),[]);
assert.match(candidate,/const canaryDecision=await r369RolloutDecision\(phone,u\.user_id\)/);
assert.match(candidate,/const result=await db\.rpc\('dfl_bot_v2_rollout_decision'/);
assert.match(candidate,/const v2Mode=v2Requested && canaryDecision==='canary'/);
assert.match(candidate,/const v2Requested=true;/);
assert.match(candidate,/const r361CanarySqlVisibility=true;/);
assert.match(candidate,/const r362Consumed=!!\(r362Existing\.data\?\.temp_data\?\.atomic_snapshot/);
assert.match(candidate,/r362\.canary\.consumed_session_restricted/);
assert.ok(candidate.indexOf('const r362Existing=await db.from') < candidate.indexOf('if(n==="/ajuda"'),
 'R362 consumed-session lock deve preceder o menu de ajuda');
assert.match(sql,/create trigger dfl_bot_v2_canary_marker_immutable_trg before update or delete/);
assert.match(sql,/create trigger dfl_bot_v2_canary_archive_immutable_trg before update or delete/);
assert.match(sql,/R366: TUDO na transacao canario e imutavel/);
assert.doesNotMatch(sql,/new\.user_id is distinct from old\.user_id/);

assert.match(candidate,/if\(v2Mode && !r361CanarySqlVisibility\)/);
assert.match(candidate,/DFL_R361_CONSUMED_SESSION_ARCHIVE_REQUIRED/);
assert.match(candidate,/const removed=await db\.from\("bot_sessions"\)\.delete\(\)\.eq\("phone",p\)/);
for (const route of ['PENDING_PICK','PENDING_CONFIRM','PENDING_EDIT','TX_SETTLE']) {
 const from=candidate.indexOf('if(s?.step==="'+route+'")');
 assert.ok(from>0,'rota ausente '+route);
 const lookahead=candidate.slice(from,from+1400);
 assert.match(lookahead,/r361IsProtectedCanary/,'rota sem verificacao '+route);
}
assert.match(candidate,/r361IsProtectedCanary\(u\.user_id,String\(txid\)\)/);
assert.match(sql,/create trigger dfl_bot_v2_canary_capture_commit_trg after update on public\.bot_sessions/);
assert.match(sql,/create trigger dfl_bot_v2_canary_transaction_guard_trg before update or delete on public\.transactions/);
assert.match(sql,/create trigger dfl_bot_v2_canary_consumed_session_guard_trg before delete on public\.bot_sessions/);
assert.match(sql,/grant execute on function public\.dfl_bot_v2_canary_archive_consumed_session\(text,text\) to service_role/);
assert.match(sql,/security definer set search_path = ''/);
assert.match(r369Sql,/create trigger dfl_bot_v2_rollout_consume_once_trg before insert/);
assert.match(r369Sql,/create table public.dfl_bot_v2_rollout_gate/);
assert.match(r369Sql,/DFL_R369_SINGLE_SHOT_GATE_CLOSED/);
const extract=candidate.match(/function r357CanaryDecision\([\s\S]*?\n}/)?.[0];
assert.ok(extract,'decisor puro ausente');
const fnSource=ts.transpileModule(extract,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const decide=Function(fnSource+'\nreturn r357CanaryDecision;')();
const user='11111111-1111-4111-8111-111111111111';
const phone='5534999999999';
const now=Date.parse('2026-10-27T20:00:00Z');
const env={enabled:'true',gate:'r330-db-approved',canaryPhone:phone,canaryUser:user,until:'2026-10-27T20:05:00Z'};
assert.equal(decide(phone,user,env,now),'canary');
assert.equal(decide(phone,user,{...env,enabled:'false'},now),'legacy');
assert.equal(decide('5534988888888',user,env,now),'legacy');
assert.equal(decide(phone,'22222222-2222-4222-8222-222222222222',env,now),'blocked');
assert.equal(decide(phone,user,{...env,gate:'wrong'},now),'blocked');
assert.equal(decide(phone,user,{...env,until:'2026-10-27T19:59:00Z'},now),'blocked');
assert.equal(decide(phone,user,{...env,until:'2026-10-27T20:11:00Z'},now),'blocked');
assert.equal(decide(phone,user,{...env,canaryPhone:'55'},now),'blocked');
console.log('R369 R2: contrato TS, isolamento e protecoes legado = OK');

const pg=new PGlite();
const U=user,A='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',K='44444444-4444-4444-8444-444444444444',P=phone;
const original={provider_message_id:'message-received-one',proposal_id:'tx:'+K,user_id:U,account_id:A,category_id:C,idempotency_key:K,type:'expense',amount:75.2,description:'Teste isolado',context:'dfl',date:'2026-10-27'};
const args=[U,P,1,'TX_CONFIRM','tx:'+K,A,C,'expense',75.2,'Teste isolado','dfl',K,'2026-10-27'];
const one=async(q,args=[]) => (await pg.query(q,args)).rows[0];
const count=async(q) => Number((await one(q)).n);
const store=async()=>pg.query("insert into public.bot_sessions(phone,step,temp_data,revision) values ($1,'TX_CONFIRM',$2::jsonb,0)",[P,JSON.stringify(original)]);
const freeze=async()=>pg.query('select public.dfl_bot_session_cas($1,$2,$3,$4,$5::jsonb) v',[P,0,'TX_CONFIRM','TX_CONFIRM',JSON.stringify({...original,atomic_snapshot:original})]);
const commit=async()=>pg.query('select public.dfl_bot_commit_single_v2('+args.map((_,i)=>'$'+(i+1)).join(',')+') v',args).then(r=>r.rows[0].v);
let checked=0;const test=async(name,fn)=>{await fn();checked++;console.log('OK:',name)};
try{
 await pg.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema auth;
 create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
 create table public.accounts(id uuid primary key,user_id uuid,context text,is_archived boolean default false,name text,balance numeric not null default 900);
 create table public.categories(id uuid primary key,user_id uuid,context text,type text);
 create table public.transactions(id uuid primary key default gen_random_uuid(),user_id uuid,account_id uuid,category_id uuid,type text,amount numeric,description text,date date,status text,context text,source text,affects_balance boolean,sync_status text,sync_attempts integer, paid boolean, paid_date date, cash_delta numeric, credit_card_id uuid, receipt_url text, notes text, idempotency_key uuid unique,created_at timestamptz,updated_at timestamptz);
 create table public.bot_sessions(phone text primary key,step text,temp_data jsonb);
 insert into public.accounts(id,user_id,context,is_archived,name,balance) values('${A}','${U}','dfl',false,'Teste',900);
 insert into public.categories(id,user_id,context,type) values('${C}','${U}','dfl','expense');
 `);
 await pg.query("select set_config('request.jwt.claim.role','service_role',false)");
 await pg.exec(baseRpc);
 await pg.exec(legacy);
 await pg.exec(sql);
 await pg.exec(r369Sql);
 await test('triggers R351 + R361 instalados no PostgreSQL local',async()=>assert.equal(await count("select count(*) n from pg_trigger where tgname in ('dfl_bot_v2_frozen_session_guard_trg','dfl_bot_v2_canary_capture_commit_trg','dfl_bot_v2_canary_transaction_guard_trg','dfl_bot_v2_canary_consumed_session_guard_trg') and not tgisinternal"),4));
 await test('transacao legada nao e bloqueada em UPDATE',async()=>{
  const r=await pg.query(`insert into public.transactions(user_id,account_id,category_id,type,amount,description,date,status,context,source,affects_balance,idempotency_key)
    values ($1,$2,$3,'income',9,'Legado','2026-10-27','pending','dfl','whatsapp',false,$4) returning id`,[U,A,C,'55555555-5555-4555-8555-555555555555']);
  const id=r.rows[0].id;await pg.query('update public.transactions set amount=10 where id=$1',[id]);assert.equal(Number((await one('select amount from public.transactions where id=$1',[id])).amount),10);
  await pg.query('delete from public.transactions where id=$1',[id]);
 });
 await test('sessao comum pode ser removida',async()=>{await store();await pg.query('delete from public.bot_sessions where phone=$1',[P]);assert.equal(await count('select count(*) n from public.bot_sessions'),0)});
 await test('congelamento nao altera ledger nem saldo',async()=>{await store();const r=await freeze();assert.equal(r.rows[0].v.applied,true);assert.equal(await count('select count(*) n from public.transactions'),0);assert.equal(Number((await one('select balance from public.accounts')).balance),900)});
 await test('R369 R2: rollout nasce OFF, sem canario e sem transacoes',async()=>{
  const gate=await one('select enabled,canary_phone,canary_user_id,consumed_at from public.dfl_bot_v2_rollout_gate');
  assert.equal(gate.enabled,false);assert.equal(gate.canary_phone,null);
  assert.equal((await one('select public.dfl_bot_v2_rollout_decision($1,$2) decision',[P,U])).decision,'legacy');
 });
 await test('R369 R2: tentativa de commit com gate OFF reverte sem criar ledger',async()=>{
  await assert.rejects(()=>commit(),/DFL_R369_SINGLE_SHOT_GATE_CLOSED/);
  assert.equal(await count('select count(*) n from public.transactions'),0);
  assert.equal(await count('select count(*) n from public.dfl_bot_v2_canary_ledger'),0);
  assert.equal((await one('select step from public.bot_sessions where phone=$1',[P])).step,'TX_CONFIRM');
 });
 await test('R369 R2: ARM valido ate 10 minutos e obrigatoriamente especifico',async()=>{
  await assert.rejects(()=>pg.query(`update public.dfl_bot_v2_rollout_gate set enabled=true,canary_phone=$1,canary_user_id=$2,expires_at=now()+interval '11 minutes'`,[P,U]),/DFL_R369_INVALID_TTL_OR_BINDING/);
  await pg.query(`update public.dfl_bot_v2_rollout_gate set enabled=true,canary_phone=$1,canary_user_id=$2,expires_at=now()+interval '5 minutes'`,[P,U]);
  const decide=async(phone,user)=>(await one('select public.dfl_bot_v2_rollout_decision($1,$2) decision',[phone,user])).decision;
  assert.equal(await decide(P,U),'canary');
  assert.equal(await decide('5534888888888',U),'legacy');
  assert.equal(await decide(P,'99999999-9999-4999-8999-999999999999'),'blocked');
  assert.equal(await count("select count(*) n from public.dfl_bot_v2_rollout_audit where event='ARM'"),1);
 });
 await test('commit V2 cria transacao e marcador na MESMA transacao',async()=>{
   const res=await commit();assert.equal(res.atomic,true);assert.equal(await count('select count(*) n from public.transactions'),1);assert.equal(await count('select count(*) n from public.dfl_bot_v2_canary_ledger'),1);
   assert.equal((await one('select status,affects_balance from public.transactions')).status,'pending');assert.equal(Number((await one('select balance from public.accounts')).balance),900);
 });
 const txId=(await one('select transaction_id from public.dfl_bot_v2_canary_ledger')).transaction_id;
 await test('R369 R2: primeiro commit desarma o gate no mesmo commit SQL',async()=>{
  const gate=await one('select enabled,consumed_at,transaction_id from public.dfl_bot_v2_rollout_gate');
  const marker=await one('select transaction_id from public.dfl_bot_v2_canary_ledger');
  assert.equal(gate.enabled,false);assert.ok(gate.consumed_at);
  assert.equal(gate.transaction_id,marker.transaction_id);
  assert.equal((await one('select public.dfl_bot_v2_rollout_decision($1,$2) decision',[P,U])).decision,'blocked');
  assert.equal(await count("select count(*) n from public.dfl_bot_v2_rollout_audit where event='CONSUME'"),1);
 });
 await test('R369 R2: nao permite rearmar nem trocar identidade depois do consumo',async()=>{
  await assert.rejects(()=>pg.query("update public.dfl_bot_v2_rollout_gate set enabled=true,expires_at=now()+interval '4 minutes'"),/DFL_R369_REARM_FORBIDDEN/);
  await assert.rejects(()=>pg.query("update public.dfl_bot_v2_rollout_gate set canary_phone='5534888888888'"),/DFL_R369_REARM_FORBIDDEN/);
 });
 await test('R369 R2: auditoria do rollout e imutavel',async()=>{
  await assert.rejects(()=>pg.query("update public.dfl_bot_v2_rollout_audit set event='ARM'"),/DFL_R369_AUDIT_IMMUTABLE/);
  await assert.rejects(()=>pg.query("delete from public.dfl_bot_v2_rollout_audit"),/DFL_R369_AUDIT_IMMUTABLE/);
  assert.equal(await count('select count(*) n from public.dfl_bot_v2_rollout_audit'),2);
 });


 await test('R366: trava TOTAL de campos adicionais e metadados do ledger',async()=>{
  const attempts=[
   ['paid',true],['paid_date','2026-10-28'],['cash_delta',1],
   ['credit_card_id','77777777-7777-4777-8777-777777777777'],
   ['receipt_url','canary-forged-receipt.pdf'],['notes','alterado'],
   ['sync_status','synced'],['sync_attempts',99],['updated_at','2026-10-28T13:00:00Z'],
  ];
  for(const [field,value] of attempts){
   await assert.rejects(
    ()=>pg.query('update public.transactions set '+field+'=$1 where id=$2',[value,txId]),
    /DFL_V2_CANARY_LEDGER_FINANCIAL_EDIT_DENIED/,'campo permitiu mutacao: '+field);
  }
  assert.equal((await one('select status from public.transactions where id=$1',[txId])).status,'pending');
 });
 await test('R366: transacao legacy sem marcador mantem metadados editaveis',async()=>{
  const id='88888888-8888-4888-8888-888888888888';
  await pg.query(`insert into public.transactions(id,user_id,account_id,category_id,type,amount,description,date,status,context,source,affects_balance,idempotency_key) values ($1,$2,$3,$4,'income',9,'Legacy permissivo','2026-10-27','pending','dfl','whatsapp',false,$5)`,[id,U,A,C,'99999999-9999-4999-8999-999999999999']);
  await pg.query('update public.transactions set notes=$1,paid=$2,cash_delta=$3 where id=$4',['legado',true,3,id]);
  const found=await one('select notes,paid,cash_delta from public.transactions where id=$1',[id]);
  assert.equal(found.notes,'legado');assert.equal(found.paid,true);assert.equal(Number(found.cash_delta),3);
  await pg.query('delete from public.transactions where id=$1',[id]);
 });

 await test('membership service_role identifica canario',async()=>{
  const r=await one('select public.dfl_bot_v2_canary_is_locked($1,$2) as locked',[U,txId]);assert.equal(r.locked,true);
  assert.equal((await one('select public.dfl_bot_v2_canary_is_locked($1,$2) as locked',[U,'ffffffff-ffff-4fff-8fff-ffffffffffff'])).locked,false);
 });
 await test('R362: marcador de canario nao pode ser alterado',async()=>
   await assert.rejects(()=>pg.query("update public.dfl_bot_v2_canary_ledger set phone='5521111111111' where transaction_id=$1",[txId]),/DFL_V2_CANARY_AUDIT_IMMUTABLE/));
 await test('R362: marcador nao pode ser apagado',async()=>
   await assert.rejects(()=>pg.query('delete from public.dfl_bot_v2_canary_ledger where transaction_id=$1',[txId]),/DFL_V2_CANARY_AUDIT_IMMUTABLE/));
 await test('bloqueia efetivacao via UPDATE status/affects_balance',async()=>await assert.rejects(()=>pg.query("update public.transactions set status='done',affects_balance=true where id=$1",[txId]),/DFL_V2_CANARY_LEDGER_FINANCIAL_EDIT_DENIED/));
 await test('bloqueia mudanca de valor',async()=>await assert.rejects(()=>pg.query('update public.transactions set amount=500 where id=$1',[txId]),/DFL_V2_CANARY_LEDGER_FINANCIAL_EDIT_DENIED/));
 await test('bloqueia troca de conta',async()=>await assert.rejects(()=>pg.query('update public.transactions set account_id=$1 where id=$2',[C,txId]),/DFL_V2_CANARY_LEDGER_FINANCIAL_EDIT_DENIED/));
 await test('bloqueia troca de categoria',async()=>await assert.rejects(()=>pg.query('update public.transactions set category_id=null where id=$1',[txId]),/DFL_V2_CANARY_LEDGER_FINANCIAL_EDIT_DENIED/));
 await test('bloqueia edicao de descricao/data/contexto',async()=>await assert.rejects(()=>pg.query("update public.transactions set description='Outra',date='2026-10-26',context='personal' where id=$1",[txId]),/DFL_V2_CANARY_LEDGER_FINANCIAL_EDIT_DENIED/));
 await test('bloqueia exclusao da transacao canario',async()=>await assert.rejects(()=>pg.query('delete from public.transactions where id=$1',[txId]),/DFL_V2_CANARY_LEDGER_DELETE_DENIED/));
 await test('bloqueia exclusao generica da sessao consumida',async()=>await assert.rejects(()=>pg.query('delete from public.bot_sessions where phone=$1',[P]),/DFL_V2_CANARY_CONSUMED_SESSION_RETAINED/));
 await test('bloqueia segundo commit com mesma revisao',async()=>await assert.rejects(()=>commit(),/DFL_BOT_SESSION_CHANGED|DFL_BOT_STALE_PROPOSAL/));
 await test('exige justificativa administrativa antes de arquivar',async()=>await assert.rejects(()=>pg.query("select public.dfl_bot_v2_canary_archive_consumed_session($1,'curto')",[P]),/DFL_V2_CANARY_ARCHIVE_REASON_REQUIRED/));
 await test('arquivamento administrativo conserva marcador e ledger',async()=>{
  const x=await one("select public.dfl_bot_v2_canary_archive_consumed_session($1,'Homologacao R361: encerrar sessao com trilha de auditoria') v",[P]);
  assert.equal(x.v.archived,true);assert.equal(x.v.financial_lock_retained,true);
  assert.equal(await count('select count(*) n from public.bot_sessions'),0);
  assert.equal(await count('select count(*) n from public.dfl_bot_v2_canary_session_archive'),1);
  assert.equal(await count('select count(*) n from public.dfl_bot_v2_canary_ledger'),1);
 });
 await test('R362: historico arquivado nao pode ser editado',async()=>
   await assert.rejects(()=>pg.query("update public.dfl_bot_v2_canary_session_archive set admin_reason='alterado' where transaction_id=$1",[txId]),/DFL_V2_CANARY_AUDIT_IMMUTABLE/));
 await test('R362: historico arquivado nao pode ser apagado',async()=>
   await assert.rejects(()=>pg.query('delete from public.dfl_bot_v2_canary_session_archive where transaction_id=$1',[txId]),/DFL_V2_CANARY_AUDIT_IMMUTABLE/));
 await test('bloqueio financeiro persiste apos arquivamento',async()=>{
  await assert.rejects(()=>pg.query("update public.transactions set status='done', affects_balance=true where id=$1",[txId]),/DFL_V2_CANARY_LEDGER_FINANCIAL_EDIT_DENIED/);
  assert.equal(Number((await one('select balance from public.accounts')).balance),900);
  assert.equal((await one('select status from public.transactions where id=$1',[txId])).status,'pending');
 });
 await test('nao autoriza arquivar duas vezes',async()=>await assert.rejects(()=>pg.query("select public.dfl_bot_v2_canary_archive_consumed_session($1,'Arquivamento repetido e indevido')",[P]),/DFL_V2_CANARY_NOT_CONSUMED/));
 await test('marcador continua confiavel para o ledger',async()=>{
  const row=await one('select phone,idempotency_key,frozen_snapshot from public.dfl_bot_v2_canary_ledger');assert.equal(row.phone,P);assert.equal(row.idempotency_key,K);assert.equal(row.frozen_snapshot.proposal_id,'tx:'+K);
 });
 console.log('R369 R2: '+checked+' cenarios PostgreSQL locais com rollout ONE-SHOT + R366 imutabilidade. Nenhum acesso remoto.');
}finally{await pg.close()}
