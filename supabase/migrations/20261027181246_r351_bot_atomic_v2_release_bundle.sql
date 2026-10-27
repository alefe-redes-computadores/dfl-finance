-- DFL Finance R350: CANDIDATA UNICA DE IMPLANTACAO, NAO APLICAR SEM APROVACAO.
-- Conteudo: R219 (CAS + commit V2), R347 (idempotencia + trigger), R350 (cancelamento seguro).
-- Preconditions: contratos do schema em producao conferidos, webhook com flags desligadas.
-- VERSOES ANTIGAS R133/R142/R146/R157/R170 NAO devem ser implantadas em paralelo.

-- ==== ORIGEM R219 ====
-- R219: MIGRACAO CANDIDATA CONSOLIDADA — REVISAR ANTES DE IMPLANTAR
-- Combina R133 (CAS de sessao) e V2 (RPC financeira atomica).
-- Nao aplicar R133/R142/R146/R157/R170 separadamente em producao junto desta candidata.
-- Implantacao depende de verificacao das dependencias, permissoes e snapshot do webhook.
-- Gerada localmente; NAO implantada.


-- === CONTRATO R133 ===
-- R133: PRÉ-PUBLICAÇÃO. NÃO IMPLANTAR SEM INTEGRAR À EXECUÇÃO FINANCEIRA.
-- Contrato aditivo para versões de sessão; nenhuma mudança no ledger.
-- O CAS nesta função cobre somente o estado da sessão, NÃO a RPC financeira.
-- Requer migração e integração transacional em etapa posterior.
alter table public.bot_sessions
  add column if not exists revision bigint not null default 0;
alter table public.bot_sessions
  add constraint bot_sessions_revision_nonnegative check (revision >= 0);
create or replace function public.dfl_bot_session_cas(
  p_phone text,
  p_expected_revision bigint,
  p_expected_step text,
  p_new_step text,
  p_new_temp_data jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $function$
declare v_revision bigint;
begin
  if p_phone is null or p_phone = '' or p_expected_revision is null or
     p_expected_revision < 0 or p_expected_step is null or
     p_new_step is null or p_new_temp_data is null or
     jsonb_typeof(p_new_temp_data) <> 'object' then
    raise exception 'DFL_BOT_SESSION_CAS_INVALID';
  end if;
  update public.bot_sessions
     set step = p_new_step,
         temp_data = p_new_temp_data,
         revision = revision + 1
   where phone = p_phone
     and revision = p_expected_revision
     and step = p_expected_step
  returning revision into v_revision;
  if not found then
    return jsonb_build_object('applied', false, 'reason', 'STALE_SESSION');
  end if;
  return jsonb_build_object('applied', true, 'revision', v_revision);
end;
$function$;
revoke all on function public.dfl_bot_session_cas(text,bigint,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.dfl_bot_session_cas(text,bigint,text,text,jsonb) to service_role;

-- === CONTRATO V2 (R170-R183) ===
-- R170: design local, NAO IMPLANTAR SEM E2E DO LEDGER REAL.
-- Pre-requisitos: bot_sessions.revision da R133 e bot_record_transaction real.
-- O CAS, autorizacao, gravacao e consumo ocorrem numa unica transacao do Postgres.
-- A entrada v2 nao depende de congelamento CAS anterior e nao tem fallback legado.
create or replace function public.dfl_bot_commit_single_v2(
 p_user_id uuid, p_phone text, p_expected_revision bigint,
 p_expected_step text, p_proposal_id text, p_account_id uuid,
 p_category_id uuid, p_type text, p_amount numeric,
 p_description text, p_context text, p_idempotency_key uuid, p_date date)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 s public.bot_sessions%rowtype;
 result jsonb;
 expected_id text := 'tx:' || p_idempotency_key::text;
 revision_stamp timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'DFL_BOT_SERVER_ONLY'; end if;
 if p_user_id is null or nullif(trim(p_phone),'') is null or length(trim(p_phone))<5
  or p_expected_revision is null or p_expected_revision<0
  or p_expected_step not in ('TX_CONFIRM','TX_ACC','TX_CAT','TX_CAT_ALL')
  or p_idempotency_key is null or p_proposal_id is distinct from expected_id
  or p_account_id is null or p_type not in ('income','expense')
  or p_amount is null or p_amount<=0 or nullif(trim(p_description),'') is null
  or p_context not in ('dfl','personal') or p_date is null then
   raise exception 'DFL_BOT_INVALID_AUTHORIZATION'; end if;
 select * into s from public.bot_sessions where phone=p_phone for update;
 if not found or s.step is distinct from p_expected_step then raise exception 'DFL_BOT_SESSION_CHANGED'; end if;
 if s.revision is distinct from p_expected_revision then raise exception 'DFL_BOT_STALE_PROPOSAL'; end if;
 if jsonb_typeof(s.temp_data) <> 'object' then raise exception 'DFL_BOT_INVALID_SESSION'; end if;
 if s.temp_data ? 'consumed_at' or s.temp_data ? 'transaction_id' then raise exception 'DFL_BOT_ALREADY_CONSUMED'; end if;
 if nullif(trim(s.temp_data->>'provider_message_id'),'') is null then raise exception 'DFL_BOT_MISSING_PROVIDER_KEY'; end if;
 -- R177: snapshot completo e imutavel antes de qualquer escrita financeira.
 -- Campos faltantes nao podem mais deixar a validacao passar.
 if not (s.temp_data ?& array['proposal_id','user_id','account_id','idempotency_key','type','amount','description','context','date'])
  or s.temp_data->>'proposal_id' is null
  or s.temp_data->>'user_id' is null
  or s.temp_data->>'account_id' is null
  or s.temp_data->>'idempotency_key' is null
  or not (s.temp_data ? 'category_id') then
   raise exception 'DFL_BOT_INCOMPLETE_SNAPSHOT';
 end if;
 -- Os campos originados do rascunho sempre devem continuar imutaveis.
 if s.temp_data->>'type' is distinct from p_type
  or (s.temp_data->>'amount')::numeric is distinct from p_amount
  or s.temp_data->>'description' is distinct from p_description
  or s.temp_data->>'context' is distinct from p_context
  or coalesce((s.temp_data->>'date')::date,p_date) is distinct from p_date
  or s.temp_data->>'proposal_id' is distinct from p_proposal_id
  or (s.temp_data->>'user_id')::uuid is distinct from p_user_id
  or (s.temp_data->>'account_id')::uuid is distinct from p_account_id
  or (s.temp_data->>'category_id')::uuid is distinct from p_category_id
  or (s.temp_data->>'idempotency_key')::uuid is distinct from p_idempotency_key
 then raise exception 'DFL_BOT_PROPOSAL_CHANGED'; end if;
 if s.temp_data ? 'proposal_updated_at' then
  revision_stamp:=(s.temp_data->>'proposal_updated_at')::timestamptz;
  if revision_stamp is null or revision_stamp>now() or revision_stamp<now()-interval '15 minutes' then
   raise exception 'DFL_BOT_PROPOSAL_EXPIRED'; end if;
 end if;
 -- O identificador da mensagem precisa ser derivado no webhook; verificar
 -- na revisao E2E que p_idempotency_key corresponde ao provider_message_id.
 result:=public.bot_record_transaction(p_user_id,p_account_id,p_type,p_amount,p_description,
  p_context,p_category_id,p_idempotency_key,p_date);
 if nullif(result->>'transaction_id','') is null then raise exception 'DFL_BOT_MISSING_TRANSACTION_ID'; end if;
 update public.bot_sessions set step='TX_SETTLE',revision=revision+1,
  temp_data=s.temp_data || jsonb_build_object(
   'proposal_id',p_proposal_id,'user_id',p_user_id,'account_id',p_account_id,
   'category_id',p_category_id,'idempotency_key',p_idempotency_key,'date',p_date,
   'transaction_id',result->>'transaction_id','consumed_at',now()::text)
 where phone=p_phone and revision=p_expected_revision;
 if not found then raise exception 'DFL_BOT_CAS_LOST'; end if;
 return result || jsonb_build_object('atomic',true,'authorized_revision',p_expected_revision,'proposal_id',p_proposal_id);
end;
$fn$;
revoke all on function public.dfl_bot_commit_single_v2(uuid,text,bigint,text,text,uuid,uuid,text,numeric,text,text,uuid,date) from public,anon,authenticated;
grant execute on function public.dfl_bot_commit_single_v2(uuid,text,bigint,text,text,uuid,uuid,text,numeric,text,text,uuid,date) to service_role;


-- ==== ORIGEM R347 ====
-- R347–R349 | CANDIDATA COMPLEMENTAR, NAO APLICAR SEPARADAMENTE DA R219.
-- Gerado a partir da RPC V2 local aprovada. Nao reescreve a R219.
-- Requer public.bot_sessions.revision, dfl_bot_commit_single_v2 e tabelas existentes.
-- Este SQL deve ser revisado e homologado antes do deploy; sem efeito financeiro imediato.
-- Ordem de implantacao: R219 consolidada, em seguida esta candidata.


create or replace function public.dfl_bot_commit_single_v2(
 p_user_id uuid, p_phone text, p_expected_revision bigint,
 p_expected_step text, p_proposal_id text, p_account_id uuid,
 p_category_id uuid, p_type text, p_amount numeric,
 p_description text, p_context text, p_idempotency_key uuid, p_date date)
returns jsonb language plpgsql security definer set search_path='' as $fn$
declare
 s public.bot_sessions%rowtype;
 result jsonb;
 expected_id text := 'tx:' || p_idempotency_key::text;
 revision_stamp timestamptz;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'DFL_BOT_SERVER_ONLY'; end if;
 if p_user_id is null or nullif(trim(p_phone),'') is null or length(trim(p_phone))<5
  or p_expected_revision is null or p_expected_revision<0
  or p_expected_step not in ('TX_CONFIRM','TX_ACC','TX_CAT','TX_CAT_ALL')
  or p_idempotency_key is null or p_proposal_id is distinct from expected_id
  or p_account_id is null or p_type not in ('income','expense')
  or p_amount is null or p_amount<=0 or nullif(trim(p_description),'') is null
  or p_context not in ('dfl','personal') or p_date is null then
   raise exception 'DFL_BOT_INVALID_AUTHORIZATION'; end if;
 select * into s from public.bot_sessions where phone=p_phone for update;
 if not found or s.step is distinct from p_expected_step then raise exception 'DFL_BOT_SESSION_CHANGED'; end if;
 if s.revision is distinct from p_expected_revision then raise exception 'DFL_BOT_STALE_PROPOSAL'; end if;
 if jsonb_typeof(s.temp_data) <> 'object' then raise exception 'DFL_BOT_INVALID_SESSION'; end if;
 if s.temp_data ? 'consumed_at' or s.temp_data ? 'transaction_id' then raise exception 'DFL_BOT_ALREADY_CONSUMED'; end if;
 if nullif(trim(s.temp_data->>'provider_message_id'),'') is null then raise exception 'DFL_BOT_MISSING_PROVIDER_KEY'; end if;
 -- R177: snapshot completo e imutavel antes de qualquer escrita financeira.
 -- Campos faltantes nao podem mais deixar a validacao passar.
 if not (s.temp_data ?& array['proposal_id','user_id','account_id','idempotency_key','type','amount','description','context','date'])
  or s.temp_data->>'proposal_id' is null
  or s.temp_data->>'user_id' is null
  or s.temp_data->>'account_id' is null
  or s.temp_data->>'idempotency_key' is null
  or not (s.temp_data ? 'category_id') then
   raise exception 'DFL_BOT_INCOMPLETE_SNAPSHOT';
 end if;
 -- Os campos originados do rascunho sempre devem continuar imutaveis.
 if s.temp_data->>'type' is distinct from p_type
  or (s.temp_data->>'amount')::numeric is distinct from p_amount
  or s.temp_data->>'description' is distinct from p_description
  or s.temp_data->>'context' is distinct from p_context
  or coalesce((s.temp_data->>'date')::date,p_date) is distinct from p_date
  or s.temp_data->>'proposal_id' is distinct from p_proposal_id
  or (s.temp_data->>'user_id')::uuid is distinct from p_user_id
  or (s.temp_data->>'account_id')::uuid is distinct from p_account_id
  or (s.temp_data->>'category_id')::uuid is distinct from p_category_id
  or (s.temp_data->>'idempotency_key')::uuid is distinct from p_idempotency_key
 then raise exception 'DFL_BOT_PROPOSAL_CHANGED'; end if;
 if s.temp_data ? 'proposal_updated_at' then
  revision_stamp:=(s.temp_data->>'proposal_updated_at')::timestamptz;
  if revision_stamp is null or revision_stamp>now() or revision_stamp<now()-interval '15 minutes' then
   raise exception 'DFL_BOT_PROPOSAL_EXPIRED'; end if;
 end if;
 -- O identificador da mensagem precisa ser derivado no webhook; verificar
 -- na revisao E2E que p_idempotency_key corresponde ao provider_message_id.
 result:=public.bot_record_transaction(p_user_id,p_account_id,p_type,p_amount,p_description,
  p_context,p_category_id,p_idempotency_key,p_date);
 if nullif(result->>'transaction_id','') is null then raise exception 'DFL_BOT_MISSING_TRANSACTION_ID'; end if;
 -- R347: nenhuma autorizacao pode consumir uma chave reutilizada para outra proposta.
 -- A RPC financeira original retorna apenas o ID em caso de duplicate=true.
 -- Conferir a linha REAL antes de consumir a sessao. FOR UPDATE serializa leituras
 -- com eventuais edicoes concorrentes da mesma transacao.
 perform 1 from public.transactions t
  where t.id=(result->>'transaction_id')::uuid
    and t.user_id=p_user_id and t.account_id=p_account_id
    and t.category_id is not distinct from p_category_id
    and t.idempotency_key=p_idempotency_key
    and t.type=p_type and t.amount=p_amount
    and t.description=trim(p_description) and t.context=p_context
    and t.date=p_date and t.source='whatsapp'
    and ((t.status='pending' and t.affects_balance=false)
      or (t.status='done' and t.affects_balance=true))
  for update;
 if not found then raise exception 'DFL_BOT_IDEMPOTENCY_PAYLOAD_MISMATCH'; end if;
 update public.bot_sessions set step='TX_SETTLE',revision=revision+1,
  temp_data=s.temp_data || jsonb_build_object(
   'proposal_id',p_proposal_id,'user_id',p_user_id,'account_id',p_account_id,
   'category_id',p_category_id,'idempotency_key',p_idempotency_key,'date',p_date,
   'transaction_id',result->>'transaction_id','consumed_at',now()::text)
 where phone=p_phone and revision=p_expected_revision;
 if not found then raise exception 'DFL_BOT_CAS_LOST'; end if;
 return result || jsonb_build_object('atomic',true,'authorized_revision',p_expected_revision,'proposal_id',p_proposal_id);
end;
$fn$;

-- R348: congelamento de sessao V2 contra upsert/save legados sem CAS.
-- Nao interfere em sessoes antigas sem atomic_snapshot.
create or replace function public.dfl_bot_v2_frozen_session_guard()
returns trigger language plpgsql security invoker set search_path='' as $guard$
begin
 if tg_op='DELETE' then
   if jsonb_typeof(old.temp_data)='object'
      and old.temp_data ? 'atomic_snapshot'
      and not (old.temp_data ? 'consumed_at') then
     raise exception 'DFL_BOT_FROZEN_DELETE_DENIED';
   end if;
   return old;
 end if;
 if jsonb_typeof(old.temp_data)='object' and old.temp_data ? 'atomic_snapshot' then
   if new.temp_data is null or jsonb_typeof(new.temp_data)<>'object'
      or new.temp_data->'atomic_snapshot' is distinct from old.temp_data->'atomic_snapshot'
      or new.temp_data->>'proposal_id' is distinct from old.temp_data->>'proposal_id'
      or new.temp_data->>'idempotency_key' is distinct from old.temp_data->>'idempotency_key'
      or new.temp_data->>'provider_message_id' is distinct from old.temp_data->>'provider_message_id'
      or new.temp_data->>'user_id' is distinct from old.temp_data->>'user_id' then
     raise exception 'DFL_BOT_FROZEN_OVERWRITE_DENIED';
   end if;
   if old.temp_data ? 'consumed_at' then
     if new.step is distinct from 'TX_SETTLE'
        or new.temp_data->>'consumed_at' is distinct from old.temp_data->>'consumed_at'
        or new.temp_data->>'transaction_id' is distinct from old.temp_data->>'transaction_id' then
       raise exception 'DFL_BOT_CONSUMED_OVERWRITE_DENIED';
     end if;
   else
     if new.step is distinct from 'TX_SETTLE'
        or new.revision is distinct from old.revision+1
        or nullif(new.temp_data->>'consumed_at','') is null
        or nullif(new.temp_data->>'transaction_id','') is null then
       raise exception 'DFL_BOT_FROZEN_OVERWRITE_DENIED';
     end if;
   end if;
 end if;
 return new;
end;
$guard$;
revoke all on function public.dfl_bot_v2_frozen_session_guard() from public,anon,authenticated;

-- Registro idempotente do gatilho. Nada e removido ou recriado a cada execucao.
do $install$ begin
 if not exists (
  select 1 from pg_catalog.pg_trigger
   where tgrelid='public.bot_sessions'::regclass
     and tgname='dfl_bot_v2_frozen_session_guard_trg'
     and not tgisinternal
 ) then
   create trigger dfl_bot_v2_frozen_session_guard_trg
   before update or delete on public.bot_sessions
   for each row execute function public.dfl_bot_v2_frozen_session_guard();
 end if;
end $install$;


-- ==== ORIGEM R350 ====
-- R350: complemento a R219+R347; nao executar isoladamente em producao.
-- Permite descartar sessao congelada e nao consumida APENAS se nenhum ledger
-- corresponde a usuario + idempotency_key. Commit concorrente segura row lock.
-- Nao altera saldo nem cria lancamento.

create or replace function public.dfl_bot_v2_frozen_session_guard()
returns trigger language plpgsql security invoker set search_path='' as $guard$
begin
 if tg_op='DELETE' then
   -- R350: cancelar rascunho congelado e permitido SOMENTE sem lancamento no ledger.
   -- A row lock da DELETE serializa com o SELECT FOR UPDATE do commit V2.
   if jsonb_typeof(old.temp_data)='object'
      and old.temp_data ? 'atomic_snapshot'
      and not (old.temp_data ? 'consumed_at') then
     if nullif(old.temp_data->>'user_id','') is null
        or nullif(old.temp_data->>'idempotency_key','') is null then
       raise exception 'DFL_BOT_FROZEN_CANCEL_MISSING_IDENTITY';
     end if;
     perform 1 from public.transactions t
       where t.user_id::text=old.temp_data->>'user_id'
         and t.idempotency_key::text=old.temp_data->>'idempotency_key'
       for update;
     if found then raise exception 'DFL_BOT_FROZEN_TRANSACTION_EXISTS'; end if;
   end if;
   return old;
 end if;
 if jsonb_typeof(old.temp_data)='object' and old.temp_data ? 'atomic_snapshot' then
   if new.temp_data is null or jsonb_typeof(new.temp_data)<>'object'
      or new.temp_data->'atomic_snapshot' is distinct from old.temp_data->'atomic_snapshot'
      or new.temp_data->>'proposal_id' is distinct from old.temp_data->>'proposal_id'
      or new.temp_data->>'idempotency_key' is distinct from old.temp_data->>'idempotency_key'
      or new.temp_data->>'provider_message_id' is distinct from old.temp_data->>'provider_message_id'
      or new.temp_data->>'user_id' is distinct from old.temp_data->>'user_id'
      -- R351: proteger tambem todas as identidades/quantias financeiras canonicas.
      or new.temp_data->>'account_id' is distinct from old.temp_data->>'account_id'
      or new.temp_data->>'category_id' is distinct from old.temp_data->>'category_id'
      or new.temp_data->>'type' is distinct from old.temp_data->>'type'
      or new.temp_data->>'amount' is distinct from old.temp_data->>'amount'
      or new.temp_data->>'description' is distinct from old.temp_data->>'description'
      or new.temp_data->>'context' is distinct from old.temp_data->>'context'
      or new.temp_data->>'date' is distinct from old.temp_data->>'date' then
     raise exception 'DFL_BOT_FROZEN_OVERWRITE_DENIED';
   end if;
   -- Root canonico e snapshot congelado devem representar os mesmos dados.
   -- A escrita do CAS cria o root e atomic_snapshot a partir do mesmo objeto.
   if new.temp_data->'atomic_snapshot'->'proposal_id' is distinct from new.temp_data->'proposal_id'
      or new.temp_data->'atomic_snapshot'->'user_id' is distinct from new.temp_data->'user_id'
      or new.temp_data->'atomic_snapshot'->'account_id' is distinct from new.temp_data->'account_id'
      or new.temp_data->'atomic_snapshot'->'category_id' is distinct from new.temp_data->'category_id'
      or new.temp_data->'atomic_snapshot'->'idempotency_key' is distinct from new.temp_data->'idempotency_key'
      or new.temp_data->'atomic_snapshot'->'type' is distinct from new.temp_data->'type'
      or new.temp_data->'atomic_snapshot'->'amount' is distinct from new.temp_data->'amount'
      or new.temp_data->'atomic_snapshot'->'description' is distinct from new.temp_data->'description'
      or new.temp_data->'atomic_snapshot'->'context' is distinct from new.temp_data->'context'
      or new.temp_data->'atomic_snapshot'->'date' is distinct from new.temp_data->'date'
      or new.temp_data->'atomic_snapshot'->'provider_message_id' is distinct from new.temp_data->'provider_message_id' then
     raise exception 'DFL_BOT_FROZEN_SNAPSHOT_MISMATCH';
   end if;
   if old.temp_data ? 'consumed_at' then
     if new.step is distinct from 'TX_SETTLE'
        or new.temp_data->>'consumed_at' is distinct from old.temp_data->>'consumed_at'
        or new.temp_data->>'transaction_id' is distinct from old.temp_data->>'transaction_id' then
       raise exception 'DFL_BOT_CONSUMED_OVERWRITE_DENIED';
     end if;
   else
     if new.step is distinct from 'TX_SETTLE'
        or new.revision is distinct from old.revision+1
        or nullif(new.temp_data->>'consumed_at','') is null
        or nullif(new.temp_data->>'transaction_id','') is null then
       raise exception 'DFL_BOT_FROZEN_OVERWRITE_DENIED';
     end if;
     -- O consumo so e permitido quando ha ledger real E identico ao rascunho.
     -- A sessao ja esta bloqueada pela operacao UPDATE. FOR UPDATE bloqueia
     -- a linha financeira enquanto a autorizacao e confirmada.
     perform 1 from public.transactions t
      where t.id=(new.temp_data->>'transaction_id')::uuid
        and t.user_id::text=new.temp_data->>'user_id'
        and t.account_id::text=new.temp_data->>'account_id'
        and t.category_id::text is not distinct from new.temp_data->>'category_id'
        and t.idempotency_key::text=new.temp_data->>'idempotency_key'
        and t.type=new.temp_data->>'type'
        and t.amount=(new.temp_data->>'amount')::numeric
        and t.description=trim(new.temp_data->>'description')
        and t.context=new.temp_data->>'context'
        and t.date::text=new.temp_data->>'date'
        and t.source='whatsapp'
        and ((t.status='pending' and t.affects_balance=false)
          or (t.status='done' and t.affects_balance=true))
      for update;
     if not found then raise exception 'DFL_BOT_CONSUMPTION_LEDGER_MISMATCH'; end if;
   end if;
 end if;
 return new;
end;
$guard$;
revoke all on function public.dfl_bot_v2_frozen_session_guard() from public,anon,authenticated;
