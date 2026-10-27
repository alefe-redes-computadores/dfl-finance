import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const migration=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026150000_r133_bot_session_cas.sql','utf8')
assert.match(migration,/create or replace function public\.dfl_bot_session_cas\(/i)
const webhook=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
assert.ok(webhook.includes('p_idempotency_key:key'),'idempotencia original preservada')
assert.ok(!webhook.includes('dfl_bot_session_cas'),'webhook nao pode consumir CAS desacoplado')
const db=new PGlite()
const phone='5511999999999', key='11111111-1111-4111-8111-111111111111'
const check=async(name,fn)=>{await fn();console.log('OK:',name)}
try {
  await db.exec(`CREATE TABLE public.bot_sessions (phone text PRIMARY KEY, step text, temp_data jsonb);
  CREATE TABLE public.r137_fake_transactions (
    id uuid PRIMARY KEY, phone text NOT NULL, value numeric NOT NULL CHECK(value>0));
  DO $$ BEGIN
   IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
   IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
  END $$;`)
  await db.exec(migration)
  await db.query('INSERT INTO public.bot_sessions(phone,step,temp_data) VALUES($1,$2,$3::jsonb)',[phone,'TX_CONFIRM','{}'])
  // Modelo isolado: a funcao e executada DENTRO da mesma transacao que grava o registro.
  // Nao substitui nem modifica as RPCs de producao.
  const atomically=async(expected,id,value,simulateError=false)=>db.transaction(async tx=>{
    const claim=await tx.query('select public.dfl_bot_session_cas($1,$2,$3,$4,$5::jsonb) as result',
      [phone,expected,'TX_CONFIRM','TX_SETTLE','{}'])
    const answer=claim.rows[0].result
    if (!answer.applied) return {applied:false,reason:answer.reason}
    await tx.query('insert into public.r137_fake_transactions(id,phone,value) values($1,$2,$3)',[id,phone,value])
    if (simulateError) throw Error('R137_SIMULATED_FAILURE')
    return {applied:true,revision:Number(answer.revision)}
  })
  await check('falha apos CAS reverte sessao e gravacao',async()=>{
    await assert.rejects(atomically(0,key,15,true),/R137_SIMULATED_FAILURE/)
    const s=await db.query('select revision,step from public.bot_sessions where phone=$1',[phone])
    const t=await db.query('select count(*)::int as n from public.r137_fake_transactions')
    assert.equal(Number(s.rows[0].revision),0);assert.equal(s.rows[0].step,'TX_CONFIRM');assert.equal(t.rows[0].n,0)
  })
  await check('confirmacao valida consome revisao e grava uma vez',async()=>{
    const r=await atomically(0,key,15)
    assert.equal(r.applied,true);assert.equal(r.revision,1)
  })
  await check('repeticao da mesma revisao nao grava novamente',async()=>{
    const r=await atomically(0,'22222222-2222-4222-8222-222222222222',15)
    assert.equal(r.applied,false)
    const t=await db.query('select count(*)::int as n from public.r137_fake_transactions')
    assert.equal(t.rows[0].n,1)
  })
  await check('revision nova nao vale em estado antigo',async()=>{
    const r=await atomically(1,'33333333-3333-4333-8333-333333333333',15)
    assert.equal(r.applied,false)
  })
  await check('rollback por restricao financeira preserva versao',async()=>{
    await db.query('update public.bot_sessions set step=$1 where phone=$2',['TX_CONFIRM',phone])
    await assert.rejects(atomically(1,'44444444-4444-4444-8444-444444444444',-1))
    const s=await db.query('select revision from public.bot_sessions where phone=$1',[phone])
    assert.equal(Number(s.rows[0].revision),1)
  })
  console.log('R137: MODELO DE ATOMICIDADE APROVADO EM PGLITE; NAO E WRAPPER DE PRODUCAO')
} finally {await db.close()}
