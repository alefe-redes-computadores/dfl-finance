-- R347–R349 | CANDIDATA COMPLEMENTAR, NAO APLICAR SEPARADAMENTE DA R219.
-- Gerado a partir da RPC V2 local aprovada. Nao reescreve a R219.
-- Requer public.bot_sessions.revision, dfl_bot_commit_single_v2 e tabelas existentes.
-- Este SQL deve ser revisado e homologado antes do deploy; sem efeito financeiro imediato.
-- Ordem de implantacao: R219 consolidada, em seguida esta candidata.

begin;
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
commit;
