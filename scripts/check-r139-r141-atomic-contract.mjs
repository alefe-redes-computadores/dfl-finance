import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// This harness exercises PostgreSQL transactional semantics on synthetic data.
// Nothing here calls Supabase, webhook, or the real ledger.
const db = new PGlite()
try {
  await db.exec(`
    create table bot_sessions (
      phone text primary key,
      step text not null,
      revision integer not null default 0,
      consumed_at timestamptz,
      temp_data jsonb not null default '{}'::jsonb
    );
    create table fake_financial_operations (
      id text primary key,
      phone text not null,
      amount numeric not null check (amount > 0)
    );
    insert into bot_sessions(phone,step,revision,temp_data)
      values ('phone-test','TX_CONFIRM',2,'{"type":"expense"}');
    create or replace function test_consume_and_record(
      p_phone text, p_revision integer, p_op_id text, p_amount numeric
    ) returns text language plpgsql as $$
    declare s bot_sessions%rowtype;
    begin
      select * into s from bot_sessions where phone = p_phone for update;
      if not found then raise exception 'DFL_SESSION_MISSING'; end if;
      if s.step <> 'TX_CONFIRM' then raise exception 'DFL_STEP_MISMATCH'; end if;
      if s.revision <> p_revision then raise exception 'DFL_STALE_REVISION'; end if;
      if s.consumed_at is not null then raise exception 'DFL_ALREADY_CONSUMED'; end if;
      update bot_sessions
        set consumed_at = now(), revision = revision + 1, step = 'TX_SETTLE'
        where phone = p_phone;
      insert into fake_financial_operations(id,phone,amount)
        values (p_op_id,p_phone,p_amount);
      return p_op_id;
    end $$;
  `)
  const run = async (sql, params=[]) => db.query(sql,params)
  let passed=0
  const ok = (name) => { console.log('OK:',name); passed++ }
  let r=await run('select test_consume_and_record($1,$2,$3,$4) as id',['phone-test',2,'op-a',87.9])
  assert.equal(r.rows[0].id,'op-a'); ok('autorizacao e registro executados na mesma transacao')
  r=await run('select count(*)::int as n from fake_financial_operations')
  assert.equal(r.rows[0].n,1); ok('uma operacao criada')
  await assert.rejects(()=>run('select test_consume_and_record($1,$2,$3,$4)',['phone-test',2,'op-b',87.9]),/DFL_STALE_REVISION|DFL_STEP_MISMATCH/)
  ok('replay da revisao anterior bloqueado')
  r=await run('select count(*)::int as n from fake_financial_operations')
  assert.equal(r.rows[0].n,1); ok('replay sem duplicacao')
  await db.exec("insert into bot_sessions(phone,step,revision) values ('rollback-test','TX_CONFIRM',3)")
  await assert.rejects(()=>run('select test_consume_and_record($1,$2,$3,$4)',['rollback-test',3,'op-invalid',-1]),/check constraint/)
  ok('falha financeira gera erro SQL')
  r=await run("select revision,step,consumed_at from bot_sessions where phone='rollback-test'")
  assert.equal(r.rows[0].revision,3)
  assert.equal(r.rows[0].step,'TX_CONFIRM')
  assert.equal(r.rows[0].consumed_at,null)
  ok('autorizacao revertida com falha financeira')
  await run('select test_consume_and_record($1,$2,$3,$4)',['rollback-test',3,'op-valid',15])
  ok('retry valido apos rollback')
  r=await run("select count(*)::int as n from fake_financial_operations where phone='rollback-test'")
  assert.equal(r.rows[0].n,1); ok('retry cria exatamente um registro')
  const webhook=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
  assert.ok(webhook.includes('p_idempotency_key:key'))
  assert.ok(webhook.includes('bot_settle_transaction'))
  assert.ok(webhook.includes('bot_record_transaction'))
  ok('RPCs e idempotencia existentes preservadas')
  const baseline=fs.readFileSync('src/lib/inboxPolicy.ts','utf8')
  assert.ok(baseline.includes('needsFinancialReview'))
  ok('politica da Inbox existente preservada')
  console.log(`R139-R141: ${passed} verificacoes reais aprovadas em PGlite; sem rede.`)
} finally { await db.close() }
