-- R133: PRÉ-PUBLICAÇÃO. NÃO IMPLANTAR SEM INTEGRAR À EXECUÇÃO FINANCEIRA.
-- Contrato aditivo para versões de sessão; nenhuma mudança no ledger.
-- O CAS nesta função cobre somente o estado da sessão, NÃO a RPC financeira.
-- Requer migração e integração transacional em etapa posterior.
begin;
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
commit;
