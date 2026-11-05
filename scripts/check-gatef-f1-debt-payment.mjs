import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

// GATE F/F1: este script SOMENTE cria um banco PGlite em memoria.
// Nao importa Supabase, nao usa rede nem credenciais da producao.
const sql = fs.readFileSync('docs/sql-candidates/gate-f-f1-debt-payment-proposal.sql', 'utf8')
const pg = new PGlite()
let count = 0
const U='11111111-1111-4111-8111-111111111111'
const OTHER='11111111-1111-4111-8111-222222222222'
const A='22222222-2222-4222-8222-222222222221'
const A2='22222222-2222-4222-8222-222222222222'
const AP='22222222-2222-4222-8222-222222222223'
const AO='22222222-2222-4222-8222-222222222224'
const D='33333333-3333-4333-8333-333333333331'
const D2='33333333-3333-4333-8333-333333333332'
const D3='33333333-3333-4333-8333-333333333333'
const D4='33333333-3333-4333-8333-333333333334'
const DP='33333333-3333-4333-8333-333333333335'
const DO='33333333-3333-4333-8333-333333333336'
const C='44444444-4444-4444-8444-444444444441'
const K='55555555-5555-4555-8555-555555555551'
const K2='55555555-5555-4555-8555-555555555552'
const K3='55555555-5555-4555-8555-555555555553'
const K4='55555555-5555-4555-8555-555555555554'
const K5='55555555-5555-4555-8555-555555555555'
const K6='55555555-5555-4555-8555-555555555556'
const date='2026-11-03'
const args=(o={})=>[o.user??U,o.debt??D,o.account??A,o.amount??30,o.date===undefined?date:o.date,o.description===undefined?'Pagamento teste':o.description,o.key===undefined?K:o.key]
const call=async(o={})=>(await pg.query('select public.bot_record_debt_payment($1::uuid,$2::uuid,$3::uuid,$4::numeric,$5::date,$6::text,$7::uuid) AS result',args(o))).rows[0].result
const one=async(text,params=[])=> (await pg.query(text,params)).rows[0]
const amount=async(id=A)=>Number((await one('select balance from accounts where id=$1',[id])).balance)
const debt=async(id=D)=>await one('select paid_amount,status,contact_id from debts where id=$1',[id])
const countTx=async()=>Number((await one('select count(*)::int as n from transactions')).n)
const check=async(name,run)=>{await run();count++;console.log('OK:',name)}
try {
  // F1-R2: pré-validação sintática dos dois erros encontrados na primeira execução.
  // Não suprime teste antigo: valida adicionalmente antes de criar o PostgreSQL isolado.
  assert.equal(/CREATE\s+POLICY\s+\w+\s+ON\s+\w+\s+TO\s+\w+\s+FOR\s+ALL/i.test(fs.readFileSync(import.meta.filename, 'utf8')), false, 'CREATE POLICY: FOR ALL deve vir antes de TO');
  assert.equal(/pg_catalog\.(greatest|least)\s*\(/i.test(sql), false, 'GREATEST/LEAST nao sao funcoes qualificaveis por schema');
  await pg.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub',TRUE),'')::uuid $$;
    CREATE TABLE public.contacts(id uuid PRIMARY KEY, user_id uuid NOT NULL, context text NOT NULL);
    CREATE TABLE public.accounts(
      id uuid PRIMARY KEY,user_id uuid NOT NULL,context text NOT NULL,balance numeric NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE public.debts(
      id uuid PRIMARY KEY,user_id uuid NOT NULL,context text NOT NULL,person_name text NOT NULL,
      total_amount numeric NOT NULL,paid_amount numeric NOT NULL DEFAULT 0,
      contact_id uuid REFERENCES public.contacts(id),
      status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partial','paid')),
      updated_at timestamptz NOT NULL DEFAULT now(),sync_status text
    );
    CREATE TABLE public.transactions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,
      type text NOT NULL,amount numeric NOT NULL,description text,account_id uuid, debt_id uuid,
      contact_id uuid,debt_applied_amount numeric,contact_credit_delta numeric,
      date date NOT NULL,status text NOT NULL,affects_balance boolean,
      context text,source text CHECK (source in ('manual','ofx_import','ai_ocr','recurring','ofx_merged','whatsapp')),
      idempotency_key uuid UNIQUE,sync_status text,created_at timestamptz,updated_at timestamptz
    );
    ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_contacts ON contacts FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
    CREATE POLICY owner_accounts ON accounts FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
    CREATE POLICY owner_debts ON debts FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
    CREATE POLICY owner_transactions ON transactions FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
    GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
    GRANT USAGE ON SCHEMA auth TO authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role;
    GRANT SELECT,INSERT,UPDATE,DELETE ON accounts,debts,transactions TO authenticated,service_role;
    GRANT SELECT ON contacts TO authenticated,service_role;
  `)
  await pg.query('insert into contacts(id,user_id,context) values($1,$2,$3)',[C,U,'dfl'])
  for(const [id,user,context,balance] of [[A,U,'dfl',100],[A2,U,'dfl',500],[AP,U,'personal',20],[AO,OTHER,'dfl',800]]) {
    await pg.query('insert into accounts(id,user_id,context,balance) values($1,$2,$3,$4)',[id,user,context,balance])
  }
  for(const [id,user,context,total,contact] of [[D,U,'dfl',100,C],[D2,U,'dfl',60,C],[D3,U,'dfl',10,C],[D4,U,'dfl',10,null],[DP,U,'personal',50,null],[DO,OTHER,'dfl',70,null]]) {
    await pg.query('insert into debts(id,user_id,context,person_name,total_amount,contact_id) values($1,$2,$3,$4,$5,$6)',[id,user,context,'Mesmo Nome',total,contact])
  }
  await check('Proposta completa instala no PostgreSQL isolado',async()=>{ await pg.exec(sql);assert.equal((await one("select count(*)::int n from pg_proc where proname='bot_record_debt_payment'")).n,1) })
  await check('RPC restrito a service_role; nao publica acesso ao anon/autenticado',async()=>{
    const r=await one(`select has_function_privilege('anon','public.bot_record_debt_payment(uuid,uuid,uuid,numeric,date,text,uuid)','EXECUTE') an,
      has_function_privilege('authenticated','public.bot_record_debt_payment(uuid,uuid,uuid,numeric,date,text,uuid)','EXECUTE') au,
      has_function_privilege('service_role','public.bot_record_debt_payment(uuid,uuid,uuid,numeric,date,text,uuid)','EXECUTE') sv`)
    assert.equal(r.an,false);assert.equal(r.au,false);assert.equal(r.sv,true)
  })
  await check('Outro usuario autenticado nao ve dividas do titular em RLS de staging',async()=>{
    await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[OTHER])
    await pg.exec('SET ROLE authenticated')
    try {
      const r=await one('select count(*)::int n from public.debts')
      assert.equal(r.n,1)
      await assert.rejects(()=>call(),/permission denied|permiss/i)
    } finally { await pg.exec('RESET ROLE') }
    await pg.query("select set_config('request.jwt.claim.sub','',false)")
  })
  await check('Anon nao pode executar RPC de pagamento',async()=>{
    await pg.exec('SET ROLE anon')
    try { await assert.rejects(()=>call(),/permission denied|permiss/i) }
    finally { await pg.exec('RESET ROLE') }
  })
  await check('Pagamento sem chave idempotente falha fechado',async()=>{
    await assert.rejects(()=>call({key:null}),/DFL_PAYMENT_IDEMPOTENCY_REQUIRED/)
    assert.equal(await amount(),100);assert.equal(await countTx(),0)
  })
  await check('Valor zero, negativo e fração de centavo rejeitados',async()=>{
    for(const value of [0,-3,1.234])await assert.rejects(()=>call({amount:value}),/DFL_PAYMENT_INVALID_AMOUNT/)
    assert.equal(await countTx(),0)
  })
  await check('Fiado ainda pendente nao aumenta saldo',async()=>{assert.equal(await amount(),100);assert.equal((await debt()).status,'pending')})
  await check('Primeiro pagamento parcial atomicamente credita apenas uma vez',async()=>{
    const r=await call();assert.equal(r.duplicate,false);assert.equal(Number(r.applied),30);assert.equal(r.debt_status,'partial')
    assert.equal(await amount(),130);const d=await debt();assert.equal(d.status,'partial');assert.equal(Number(d.paid_amount),30)
    assert.equal(await countTx(),1)
  })
  await check('Replay igual retorna duplicate e nao altera saldo',async()=>{
    const r=await call();assert.equal(r.duplicate,true);assert.equal(await amount(),130);assert.equal(await countTx(),1)
  })
  for(const [name,override] of [
    ['valor divergente',{amount:31}],['conta divergente',{account:A2}],
    ['outra divida',{debt:D2}],['data divergente',{date:'2026-11-04'}],
    ['descricao divergente',{description:'Outra descricao'}],['outro titular',{user:OTHER}],
  ])await check(`Replay com ${name} rejeitado sem saldo extra`,async()=>{
    await assert.rejects(()=>call(override),/DFL_PAYMENT_IDEMPOTENCY_CONFLICT/)
    assert.equal(await amount(),130);assert.equal(await amount(A2),500);assert.equal(await countTx(),1)
  })
  await check('Quitacao posterior com nova chave: 30+70=100; estado paid',async()=>{
    const r=await call({amount:70,key:K2});assert.equal(r.duplicate,false);assert.equal(r.debt_status,'paid')
    assert.equal(await amount(),200);const d=await debt();assert.equal(Number(d.paid_amount),100);assert.equal(d.status,'paid')
    assert.equal(await countTx(),2)
  })
  await check('Replay apos quitacao retorna duplicate=true e nao duplica saldo',async()=>{
    const r=await call({amount:70,key:K2});assert.equal(r.duplicate,true);assert.equal(await amount(),200);assert.equal(await countTx(),2)
  })
  await check('Outro pagamento novo para divida quitada e rejeitado',async()=>{
    await assert.rejects(()=>call({amount:1,key:K3}),/Cobrança já está quitada/)
    assert.equal(await amount(),200)
  })
  await check('Duas vendas do mesmo contato nao misturam amortizacoes',async()=>{
    const r=await call({debt:D2,amount:25,key:K3});assert.equal(r.debt_status,'partial')
    assert.equal(Number((await debt(D2)).paid_amount),25);assert.equal(Number((await debt()).paid_amount),100)
    assert.equal(await amount(),225)
  })
  await check('Quitacao da segunda divida nao modifica a primeira',async()=>{
    const r=await call({debt:D2,amount:35,key:K4});assert.equal(r.debt_status,'paid')
    assert.equal(Number((await debt(D2)).paid_amount),60);assert.equal((await debt()).status,'paid')
    assert.equal(await amount(),260)
  })
  await check('Excedente com contato explicito vira credito, sem inflar quitacao',async()=>{
    const r=await call({debt:D3,amount:15,key:K5});assert.equal(Number(r.applied),10);assert.equal(Number(r.credit),5)
    assert.equal(Number((await debt(D3)).paid_amount),10);assert.equal(await amount(),275)
    const tx=await one('select debt_applied_amount,contact_credit_delta,contact_id from transactions where idempotency_key=$1',[K5])
    assert.equal(Number(tx.debt_applied_amount),10);assert.equal(Number(tx.contact_credit_delta),5);assert.equal(tx.contact_id,C)
  })
  await check('Excedente sem contato confirmado rejeitado e revertido',async()=>{
    await assert.rejects(()=>call({debt:D4,amount:20,key:K6}),/Excedente exige contato vinculado/)
    assert.equal(await amount(),275);assert.equal(Number((await debt(D4)).paid_amount),0)
  })
  await check('Divida de outro usuario nao pode ser usada pelo titular',async()=>{
    await assert.rejects(()=>call({debt:DO,amount:5,key:K6}),/Cobrança não encontrada/)
    assert.equal(await amount(),275)
  })
  await check('Conta de outro usuario nao pertence ao titular',async()=>{
    await assert.rejects(()=>call({debt:D4,account:AO,amount:5,key:K6}),/Conta não encontrada/)
    assert.equal(await amount(AO),800)
  })
  await check('Contexto Empresa/Pessoal misturado e recusado',async()=>{
    await assert.rejects(()=>call({debt:DP,account:A,amount:5,key:K6}),/contextos diferentes/)
    assert.equal(await amount(),275);assert.equal(await amount(AP),20)
  })
  await check('Dia civil Sao Paulo aplicado quando data omitida',async()=>{
    const newKey='55555555-5555-4555-8555-555555555557'
    const r=await call({debt:D4,amount:5,key:newKey,date:null})
    assert.equal(r.duplicate,false)
    const tx=await one('select date::text as d from transactions where idempotency_key=$1',[newKey])
    const expected=await one("select (timezone('America/Sao_Paulo',now())::date)::text as d")
    assert.equal(tx.d,expected.d)
  })
  await check('Replay concorrente em fila do mesmo motor preserva uma transacao',async()=>{
    const key='55555555-5555-4555-8555-555555555558'
    const responses=await Promise.all([call({debt:D4,amount:3,key}),call({debt:D4,amount:3,key})])
    assert.deepEqual(responses.map(r=>r.duplicate).sort(),[false,true].sort())
    assert.equal(Number((await debt(D4)).paid_amount),8)
    assert.equal((await one('select count(*)::int n from transactions where idempotency_key=$1',[key])).n,1)
  })
  await check('Sem alterar schema real, sem mensagens, sem writes remotas',async()=>{
    assert.equal(/supabase\.co|fetch\(|https?:\/\//i.test(sql),false)
    assert.equal((await one('select count(*)::int n from transactions')).n,7)
  })
  console.log(`GATE F F1: ${count} provas de PostgreSQL isolado aprovadas (nao homologacao de producao).`)
} finally { await pg.close() }
