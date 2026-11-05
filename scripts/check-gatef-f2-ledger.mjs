import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// DFL F2: os dados e contatos abaixo sao ficticios; banco PGlite apenas em memoria.
const source=fs.readFileSync('docs/sql-candidates/gate-f-f2-consultas-readonly.sql','utf8')
const labels=['RECEIVABLES','LINKS','TRANSACTIONS','OUTBOX','ROLLOUT']
const extract=(label)=>{
  const match=source.match(new RegExp(`-- GATE_F2_QUERY:${label}\\n([\\s\\S]*?);(?:\\r?\\n|$)`))
  assert.ok(match,`Consulta ${label} ausente`)
  const sql=match[1].trim()
  assert.match(sql,/^(WITH|SELECT)\b/i)
  const flattened=sql.replace(/'(?:''|[^'])*'/g,"''")
  assert.doesNotMatch(flattened,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE|CALL|PERFORM|DO)\b/i)
  assert.doesNotMatch(flattened,/\b(?:dblink|http_post|net\.http|pg_sleep|supabase)\b/i)
  return sql
}
const sql=Object.fromEntries(labels.map(x=>[x,extract(x)]))
const pg=new PGlite()
let count=0
const check=async(name,fn)=>{await fn();count++;console.log('OK:',name)}
const one=async(q,p=[]) => (await pg.query(q,p)).rows[0]
const U='11111111-1111-4111-8111-111111111111', O='11111111-1111-4111-8111-222222222222'
const C='44444444-4444-4444-8444-444444444441'
const prefix='33333333-3333-4333-8333-33333333333'
const d=(i)=>prefix+i
try {
  await pg.exec(`
    CREATE TABLE public.contacts(id uuid PRIMARY KEY,user_id uuid NOT NULL,context text NOT NULL);
    CREATE TABLE public.debts(id uuid PRIMARY KEY,user_id uuid NOT NULL,context text NOT NULL,contact_id uuid, total_amount numeric NOT NULL,paid_amount numeric NOT NULL,status text NOT NULL);
    CREATE TABLE public.transactions(id uuid PRIMARY KEY,user_id uuid,context text,debt_id uuid,contact_id uuid,type text,status text,amount numeric, debt_applied_amount numeric,affects_balance boolean,idempotency_key uuid);
    CREATE TABLE public.dfl_messaging_outbox(id uuid PRIMARY KEY,source text,event_type text,status text,attempts int,provider_message_id text,last_error text);
    CREATE TABLE public.dfl_bot_v2_rollout_gate(enabled boolean NOT NULL);
    CREATE TABLE public.finance_sync_settings(singleton boolean PRIMARY KEY,enforce_atomic boolean NOT NULL);
    INSERT INTO public.dfl_bot_v2_rollout_gate VALUES(false);
    INSERT INTO public.finance_sync_settings VALUES(true,false);
  `)
  await pg.query('INSERT INTO public.contacts(id,user_id,context) VALUES($1,$2,$3)',[C,U,'dfl'])
  const debts=[
    [d(1),U,'dfl',null,100,0,'paid'],[d(2),U,'dfl',null,50,30,'paid'],
    [d(3),U,'dfl',null,80,10,'paid'],[d(4),U,'dfl',null,40,0,'pending'],
    [d(5),U,'personal',null,120,50,'partial'],[d(6),U,'dfl',C,20,20,'paid'],
  ]
  for(const x of debts)await pg.query('INSERT INTO public.debts(id,user_id,context,contact_id,total_amount,paid_amount,status) VALUES($1,$2,$3,$4,$5,$6,$7)',x)
  for(let i=0;i<5;i++){
    const amounts=[100,50,80,50,20]
    const debts=[d(1),d(2),d(3),d(5),d(6)]
    const ctx=i===3?'personal':'dfl'
    const tx=`55555555-5555-4555-8555-55555555555${i+1}`
    await pg.query('INSERT INTO public.transactions(id,user_id,context,debt_id,type,status,amount,debt_applied_amount,affects_balance,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[
      tx,U,ctx,debts[i],'income','done',amounts[i],amounts[i],i===3?false:true,i===4?tx:null
    ])
  }
  const events=[['site','order.created',5],['site','order.production',5],['site','order.ready',4],['entregas','delivery.completed',5],['entregas','delivery.next_stop',4],['entregas','delivery.started',2]]
  let index=1
  for(const [source,event_type,qty] of events)for(let j=0;j<qty;j++){
    const uuid=`66666666-6666-4666-8666-${String(index).padStart(12,'0')}`
    const err=index<=18?'provider 503 response':'provider unknown response'
    await pg.query('INSERT INTO public.dfl_messaging_outbox(id,source,event_type,status,attempts,last_error) VALUES($1,$2,$3,$4,$5,$6)',[uuid,source,event_type,'dead_letter',5,err])
    index++
  }
  await check('Consultas SQL seguem somente leitura, com cinco blocos identificados',async()=>assert.equal(labels.length,5))
  await check('Reconcilia tres divergencias de snapshot sem criar movimento',async()=>{
    const r=await one(sql.RECEIVABLES)
    assert.equal(r.total_debts,6);assert.equal(r.missing_contact,5)
    assert.equal(r.paid_snapshot_short,3);assert.equal(r.paid_ledger_incomplete,0)
    assert.equal(r.snapshot_ledger_difference,3);assert.equal(r.invalid_partial,0);assert.equal(r.invalid_pending,0)
    assert.equal(r.dfl_debts,5);assert.equal(r.personal_debts,1)
  })
  await check('Consulta de vinculos detecta dados corretamente associados',async()=>{
    const r=await one(sql.LINKS)
    assert.equal(r.owner_mismatch,0);assert.equal(r.context_mismatch,0);assert.equal(r.missing_reference,0)
  })
  await check('Consulta de transacoes localiza idempotencia ausente sem corrigir dados',async()=>{
    const r=await one(sql.TRANSACTIONS)
    assert.equal(r.debt_linked,5);assert.equal(r.no_idempotency,4)
    assert.equal(r.wrong_owner,0);assert.equal(r.wrong_context,0);assert.equal(r.wrong_contact,0)
  })
  await check('Atribuicao de contato com outro titular gera alerta e nunca vinculacao automatica',async()=>{
    const otherC='44444444-4444-4444-8444-444444444442'
    await pg.query('INSERT INTO public.contacts(id,user_id,context) VALUES($1,$2,$3)',[otherC,O,'personal'])
    await pg.query('UPDATE public.debts SET contact_id=$1 WHERE id=$2',[otherC,d(4)])
    const r=await one(sql.LINKS);assert.equal(r.owner_mismatch,1);assert.equal(r.context_mismatch,1)
    await pg.query('UPDATE public.debts SET contact_id=NULL WHERE id=$1',[d(4)])
  })
  await check('Vinculo transacional de outro contexto e proprietario e detectado',async()=>{
    const bad='55555555-5555-4555-8555-555555555559'
    await pg.query('INSERT INTO public.transactions(id,user_id,context,debt_id,type,status,amount) VALUES($1,$2,$3,$4,$5,$6,$7)',[bad,O,'personal',d(1),'income','pending',1])
    const r=await one(sql.TRANSACTIONS);assert.equal(r.wrong_owner,1);assert.equal(r.wrong_context,1)
    await pg.query('DELETE FROM public.transactions WHERE id=$1',[bad])
  })
  await check('Os 25 dead letters sao inventariados por origem, evento e tentativas',async()=>{
    const r=await pg.query(sql.OUTBOX)
    assert.equal(r.rows.reduce((n,x)=>n+x.qty,0),25)
    assert.equal(r.rows.filter(x=>x.source==='site').reduce((n,x)=>n+x.qty,0),14)
    assert.equal(r.rows.filter(x=>x.source==='entregas').reduce((n,x)=>n+x.qty,0),11)
    assert.ok(r.rows.every(x=>x.attempts===5 && x.no_provider_id===x.qty))
    assert.equal(r.rows.reduce((n,x)=>n+x.likely_provider_5xx,0),18)
  })
  await check('Bot V2 OFF e modo atomico OFF conferidos sem atualizar configuracao',async()=>{
    const r=await one(sql.ROLLOUT);assert.equal(r.bot_v2_enabled,false);assert.equal(r.enforce_atomic,false)
  })
  await check('Consultas agregadas nao retornam nomes, identificadores ou valores individuais',async()=>{
    for(const name of labels){const r=await pg.query(sql[name]);const keys=Object.keys(r.rows[0]||{})
      assert.ok(!keys.some(x=>/^(id|user_id|phone|email|person_name|total_amount|paid_amount|last_error|payload|provider_message_id)$/i.test(x)),name)
    }
  })
  console.log(`GATE F F2: ${count} provas de reconciliacao e outbox em PGlite. Nenhum dado real alterado.`)
} finally { await pg.close() }
