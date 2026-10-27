import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
const migration=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026150000_r133_bot_session_cas.sql','utf8')
assert.match(migration,/revision\s*=\s*revision\s*\+\s*1/)
const db=new PGlite()
try{
 await db.exec(`CREATE TABLE IF NOT EXISTS public.bot_sessions(phone text primary key,step text,temp_data jsonb);`)
 // The SQL under test includes grants to roles present in Supabase, create them locally.
 await db.exec(`DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
 END $$;`)
 await db.exec(migration)
 const call=async(expected,step='TX_CONFIRM',newStep='TX_CONFIRM',payload={a:1})=>{
  const r=await db.query('select public.dfl_bot_session_cas($1,$2,$3,$4,$5::jsonb) as result',['5511999999999',expected,step,newStep,JSON.stringify(payload)])
  return r.rows[0].result
 }
 await db.exec(`INSERT INTO public.bot_sessions(phone,step,temp_data) VALUES('5511999999999','TX_CONFIRM','{}');`)
 let r=await call(0);assert.equal(r.applied,true);assert.equal(Number(r.revision),1);console.log('OK: CAS inicial incrementa versao')
 r=await call(0);assert.equal(r.applied,false);assert.equal(r.reason,'STALE_SESSION');console.log('OK: confirmacao duplicada nao consome revisao antiga')
 r=await call(1,'TX_CORRECT');assert.equal(r.applied,false);console.log('OK: estado incorreto e rejeitado')
 r=await call(1,'TX_CONFIRM','TX_SETTLE',{transaction_id:'fake'});assert.equal(r.applied,true);console.log('OK: transicao exclusiva entre estados')
 r=await call(2,'TX_CONFIRM');assert.equal(r.applied,false);console.log('OK: estado anterior nao pode consumir sessao avancada')
 const invalid=[[-1,'TX_SETTLE','TX_SETTLE',{}],[null,'TX_SETTLE','TX_SETTLE',{}]]
 for(const [v,a,b,p] of invalid){await assert.rejects(()=>call(v,a,b,p));console.log('OK: parametros invalidos rejeitados')}
 const row=await db.query('select revision,step,temp_data from public.bot_sessions where phone=$1',['5511999999999'])
 assert.equal(Number(row.rows[0].revision),2)
 assert.equal(row.rows[0].step,'TX_SETTLE')
 assert.equal(row.rows[0].temp_data.transaction_id,'fake')
 console.log('OK: estado final preservado')
 // Explicit limitation: CAS alone is not an atomic authorization+financial transaction.
 const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
 assert.ok(wh.includes('p_idempotency_key:key'),'idempotencia preexistente')
 assert.ok(!wh.includes('dfl_bot_session_cas'),'CAS nao deve ser ativado isoladamente')
 console.log('OK: webhook NAO chama CAS nao transacional')
 console.log('R134–R136: PostgreSQL isolado aprovado; nao comprova transacao financeira atomica')
} finally {await db.close()}
