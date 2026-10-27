-- R146-R150: wrapper local, NAO implantado. Nao habilitar webhook ate
-- conferir o contrato exato de temp_data e aplicar migrations em ordem.
-- Esta RPC e apenas para income/expense unitario, nao recorrencia/transferencia.
-- Todas as validacoes e operacao financeira compartilham a MESMA transacao.
create or replace function public.dfl_bot_record_single_atomic_r146(
 p_user_id uuid, p_phone text, p_expected_revision bigint,
 p_expected_step text, p_expected_proposal text,
 p_account_id uuid, p_category_id uuid,
 p_type text, p_amount numeric, p_description text, p_context text,
 p_idempotency_key uuid, p_date date
) returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare
 s public.bot_sessions%rowtype;
 v_revision bigint;
 v_proposal text;
 v_account_id uuid;
 v_category_id uuid;
 v_result jsonb;
 v_time timestamptz;
begin
 -- Deny direct client access even under unexpected grants.
 if auth.role() is distinct from 'service_role' then
   raise exception 'DFL_BOT_SERVER_ONLY';
 end if;
 if p_user_id is null or nullif(trim(p_phone),'') is null or length(trim(p_phone))<5
    or p_expected_revision is null or p_expected_revision<0
    or p_expected_step not in ('TX_CONFIRM','TX_ACC','TX_CAT','TX_CAT_ALL')
    or nullif(trim(p_expected_proposal),'') is null
    or p_account_id is null or p_idempotency_key is null
    or p_type not in ('income','expense')
    or p_amount is null or p_amount<=0 or p_date is null
    or p_context not in ('dfl','personal')
    or nullif(trim(p_description),'') is null then
    raise exception 'DFL_BOT_INVALID_AUTHORIZATION';
 end if;
 select * into s from public.bot_sessions where phone=p_phone for update;
 if not found or s.step is distinct from p_expected_step then
   raise exception 'DFL_BOT_SESSION_CHANGED'; end if;
 if jsonb_typeof(s.temp_data) <> 'object' then raise exception 'DFL_BOT_MALFORMED_SESSION'; end if;
 -- R133 bigint revision, never implicitly fall back to proposal_revision.
 v_revision:=s.revision;
 v_proposal:=s.temp_data->>'proposal_id';
 if v_revision is distinct from p_expected_revision
    or v_proposal is distinct from p_expected_proposal then
   raise exception 'DFL_BOT_STALE_PROPOSAL'; end if;
 if s.temp_data ? 'consumed_at' then raise exception 'DFL_BOT_ALREADY_CONSUMED'; end if;
 -- Fail-closed: every financial field must be frozen in the session.
 -- A later integration must store this normalized snapshot before requesting
 -- this RPC, and the snapshot must be bound to the authorization.
 if s.temp_data->>'type' is distinct from p_type
    or (s.temp_data->>'amount')::numeric is distinct from p_amount
    or s.temp_data->>'description' is distinct from p_description
    or s.temp_data->>'context' is distinct from p_context
    or (s.temp_data->>'date')::date is distinct from p_date
    or (s.temp_data->>'account_id')::uuid is distinct from p_account_id
    or (s.temp_data->>'category_id')::uuid is distinct from p_category_id
    or (s.temp_data->>'user_id')::uuid is distinct from p_user_id
    or (s.temp_data->>'idempotency_key')::uuid is distinct from p_idempotency_key then
   raise exception 'DFL_BOT_PROPOSAL_CHANGED'; end if;
 -- No stale version may be accepted after the configured explicit correction window.
 if s.temp_data ? 'proposal_updated_at' then
   v_time := (s.temp_data->>'proposal_updated_at')::timestamptz;
   if v_time is null or v_time>now() or v_time<now()-interval '15 minutes' then
     raise exception 'DFL_BOT_PROPOSAL_EXPIRED'; end if;
 end if;
 -- Existing RPC retains ownership/idempotency and creates a pending entry.
 -- An exception from it rolls back the session and the ledger together.
 v_result:=public.bot_record_transaction(
   p_user_id,p_account_id,p_type,p_amount,p_description,
   p_context,p_category_id,p_idempotency_key,p_date);
 update public.bot_sessions
   set step='TX_SETTLE',
       revision=revision+1,
       temp_data=jsonb_set(s.temp_data,'{consumed_at}',to_jsonb(now()::text),true)
 where phone=p_phone and revision=p_expected_revision;
 if not found then raise exception 'DFL_BOT_CAS_LOST'; end if;
 return v_result || jsonb_build_object('proposal_id',v_proposal,
   'authorized_revision',v_revision,'atomic',true);
end;
$fn$;
revoke all on function public.dfl_bot_record_single_atomic_r146(uuid,text,bigint,text,text,uuid,uuid,text,numeric,text,text,uuid,date) from public,anon,authenticated;
grant execute on function public.dfl_bot_record_single_atomic_r146(uuid,text,bigint,text,text,uuid,uuid,text,numeric,text,text,uuid,date) to service_role;
