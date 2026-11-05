import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'

// DFL F2: cria somente PostgreSQL WASM local EM MEMORIA, sem Supabase e sem rede.
const db = new PGlite()
const U = '11111111-1111-4111-8111-111111111111'
const OTHER = '11111111-1111-4111-8111-222222222222'
const DFL = '33333333-3333-4333-8333-333333333331'
const PERSONAL = '33333333-3333-4333-8333-333333333332'
const OTHER_DEBT = '33333333-3333-4333-8333-333333333333'
let count = 0
const check = async (name, run) => { await run(); console.log('OK:', name); count++ }
const one = async (sql, params=[]) => (await db.query(sql, params)).rows[0]
const claim = async (id) => db.query("select set_config('request.jwt.claim.sub',$1,false)",[id])
const asRole = async (role, f) => {
  await db.exec(`SET ROLE ${role}`)
  try { return await f() } finally { await db.exec('RESET ROLE') }
}
try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
    CREATE TABLE public.finance_sync_settings(singleton boolean PRIMARY KEY,enforce_atomic boolean NOT NULL);
    INSERT INTO public.finance_sync_settings VALUES (true,false);
    CREATE OR REPLACE FUNCTION public.dfl_atomic_finance_required()
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
      SELECT enforce_atomic FROM public.finance_sync_settings WHERE singleton=true $$;
    REVOKE ALL ON FUNCTION public.dfl_atomic_finance_required() FROM PUBLIC,anon;
    GRANT EXECUTE ON FUNCTION public.dfl_atomic_finance_required() TO authenticated,service_role;
    CREATE TABLE public.contacts(id uuid PRIMARY KEY,user_id uuid NOT NULL,context text NOT NULL);
    CREATE TABLE public.accounts(id uuid PRIMARY KEY,user_id uuid NOT NULL,context text NOT NULL,balance numeric NOT NULL);
    CREATE TABLE public.debts(id uuid PRIMARY KEY,user_id uuid NOT NULL,context text NOT NULL,total_amount numeric NOT NULL,paid_amount numeric NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','partial','paid')));
    CREATE TABLE public.transactions(id uuid PRIMARY KEY,user_id uuid NOT NULL,context text NOT NULL, debt_id uuid,amount numeric NOT NULL, idempotency_key uuid UNIQUE);
    CREATE TABLE public.dfl_messaging_outbox(id uuid PRIMARY KEY,status text NOT NULL);
    CREATE TABLE public.dfl_bot_v2_rollout_gate(enabled boolean NOT NULL DEFAULT false);
    INSERT INTO public.dfl_bot_v2_rollout_gate(enabled) VALUES(false);
    ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.dfl_messaging_outbox ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.dfl_bot_v2_rollout_gate ENABLE ROW LEVEL SECURITY;
    CREATE POLICY owner_contacts ON public.contacts FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY owner_accounts ON public.accounts FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY owner_debts ON public.debts FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY owner_transactions ON public.transactions FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
    CREATE POLICY dfl_atomic_insert ON public.debts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
      (NOT (SELECT public.dfl_atomic_finance_required())) OR
      ((SELECT current_setting('dfl.financial_batch',true))='on'));
    CREATE POLICY dfl_atomic_update ON public.debts AS RESTRICTIVE FOR UPDATE TO authenticated USING(
      (NOT (SELECT public.dfl_atomic_finance_required())) OR
      ((SELECT current_setting('dfl.financial_batch',true))='on')) WITH CHECK(
      (NOT (SELECT public.dfl_atomic_finance_required())) OR
      ((SELECT current_setting('dfl.financial_batch',true))='on'));
    REVOKE ALL ON public.dfl_messaging_outbox FROM PUBLIC,anon,authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.dfl_messaging_outbox TO service_role;
    CREATE POLICY server_only_deny ON public.dfl_messaging_outbox FOR ALL TO PUBLIC USING(false) WITH CHECK(false);
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.contacts,public.accounts,public.debts,public.transactions TO authenticated,service_role;
    GRANT SELECT ON public.contacts,public.accounts,public.debts,public.transactions TO anon;
  `)
  await db.query('INSERT INTO public.debts(id,user_id,context,total_amount) VALUES ($1,$2,$3,100),($4,$2,$5,50),($6,$7,$3,75)',[DFL,U,'dfl',PERSONAL,'personal',OTHER_DEBT,OTHER])
  await db.query('INSERT INTO public.dfl_messaging_outbox(id,status) VALUES($1,$2)',['44444444-4444-4444-8444-444444444441','dead_letter'])
  await check('RLS instalada, owner policies permissivas e atomic policies restritivas',async()=>{
    const r=await db.query("select polname,polpermissive from pg_policy where polrelid='public.debts'::regclass order by polname")
    const types=Object.fromEntries(r.rows.map(x=>[x.polname,x.polpermissive]))
    assert.equal(types.owner_debts,true);assert.equal(types.dfl_atomic_insert,false);assert.equal(types.dfl_atomic_update,false)
  })
  await check('SECURITY DEFINER somente leitura e path vazio, anon sem execute',async()=>{
    const row=await one("SELECT prosecdef,proconfig FROM pg_proc WHERE oid='public.dfl_atomic_finance_required()'::regprocedure")
    assert.equal(row.prosecdef,true);assert.ok(String(row.proconfig).includes('search_path='))
    const r=await one("select has_function_privilege('anon','public.dfl_atomic_finance_required()','EXECUTE') an,has_function_privilege('authenticated','public.dfl_atomic_finance_required()','EXECUTE') au")
    assert.equal(r.an,false);assert.equal(r.au,true)
  })
  await check('Proprietario enxerga somente registros proprios (ambos contextos)',async()=>{
    await claim(U)
    await asRole('authenticated',async()=>{
      const r=await one('SELECT count(*)::int n FROM public.debts');assert.equal(r.n,2)
      const dfl=await one("SELECT count(*)::int n FROM public.debts WHERE context='dfl'");assert.equal(dfl.n,1)
      const per=await one("SELECT count(*)::int n FROM public.debts WHERE context='personal'");assert.equal(per.n,1)
    })
  })
  await check('Outro autenticado nao enxerga dividas do proprietario',async()=>{
    await claim(OTHER)
    await asRole('authenticated',async()=>{
      const r=await one('SELECT count(*)::int n FROM public.debts');assert.equal(r.n,1)
      await assert.rejects(()=>db.query('INSERT INTO public.debts(id,user_id,context,total_amount) VALUES ($1,$2,$3,10)', ['33333333-3333-4333-8333-333333333334',U,'dfl']), /row-level security|permission denied/i)
    })
  })
  await check('Sem claim e anon sem acesso financeiro (mesmo com SELECT grant)',async()=>{
    await claim('')
    await asRole('authenticated',async()=>{const r=await one('SELECT count(*)::int n FROM public.debts');assert.equal(r.n,0)})
    await asRole('anon',async()=>{const r=await one('SELECT count(*)::int n FROM public.debts');assert.equal(r.n,0)})
  })
  await check('Outbox nao exposto a authenticated ou anon',async()=>{
    for(const role of ['authenticated','anon'])await asRole(role,async()=>{
      await assert.rejects(()=>db.query('SELECT count(*)::int n FROM public.dfl_messaging_outbox'),/permission denied/i)
    })
  })
  await check('Service role pode consultar dados de todas identidades e outbox (somente ambiente isolado)',async()=>{
    await asRole('service_role',async()=>{
      const d=await one('SELECT count(*)::int n FROM public.debts');assert.equal(d.n,3)
      const o=await one('SELECT count(*)::int n FROM public.dfl_messaging_outbox');assert.equal(o.n,1)
    })
  })
  await check('Bot V2 permanece OFF na fixture',async()=>{
    const r=await one('SELECT count(*) FILTER(WHERE enabled)::int n FROM public.dfl_bot_v2_rollout_gate');assert.equal(r.n,0)
  })
  await check('Atomic flag OFF permite gravacao legitima com owner RLS',async()=>{
    await claim(U)
    await asRole('authenticated',async()=>{
      const r=await db.query("UPDATE public.debts SET paid_amount=10,status='partial' WHERE id=$1 RETURNING id",[DFL])
      assert.equal(r.rows.length,1)
    })
  })
  await check('Atomic flag ON bloqueia UPDATE sem sessao atomica',async()=>{
    await db.exec("UPDATE public.finance_sync_settings SET enforce_atomic=true WHERE singleton=true")
    await claim(U)
    await asRole('authenticated',async()=>{
      const r=await db.query("UPDATE public.debts SET paid_amount=20 WHERE id=$1 RETURNING id",[DFL])
      assert.equal(r.rows.length,0)
    })
    const r=await one('SELECT paid_amount FROM public.debts WHERE id=$1',[DFL]);assert.equal(Number(r.paid_amount),10)
  })
  await check('Flag atomica nao substitui isolamento do proprietario',async()=>{
    await db.query("select set_config('dfl.financial_batch','on',false)")
    await claim(OTHER)
    await asRole('authenticated',async()=>{
      const r=await db.query("UPDATE public.debts SET paid_amount=50 WHERE id=$1 RETURNING id",[DFL]);assert.equal(r.rows.length,0)
    })
  })
  await check('A segregacao Empresa/Pessoal depende de filtro explicito para mesmo usuario',async()=>{
    await claim(U)
    await asRole('authenticated',async()=>{
      const r=await one('SELECT count(*)::int n FROM public.debts');assert.equal(r.n,2)
    })
    console.log('AVISO: RLS por user_id nao restringe contexto de um mesmo titular; validar filtro da API/app em staging.')
  })
  console.log(`GATE F F2: ${count} provas de RLS e permissoes PGlite. Nenhum acesso a producao.`)
} finally { await db.close() }
