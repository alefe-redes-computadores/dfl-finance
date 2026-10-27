-- R142: Preparacao LOCAL, NAO IMPLANTAR antes da validacao da R143.
-- Escopo: transacao simples income/expense; sem recorrencias ou transferencias.
-- O webhook existente NAO chama esta funcao nesta versao.
-- O lock e a chamada financeira vivem na MESMA transacao PostgreSQL.
create or replace function public.dfl_bot_commit_proposal_r142(
 p_user_id uuid, p_phone text, p_expected_revision integer,
 p_proposal_id text, p_account_id uuid, p_type text, p_amount numeric,
 p_description text, p_context text, p_category_id uuid,
 p_idempotency_key uuid, p_date date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 v_session public.bot_sessions%rowtype;
 v_current integer;
 v_proposal text;
 v_result jsonb;
begin
 if current_user <> 'postgres' and auth.role() is distinct from 'service_role' then
   raise exception 'DFL_BOT_SERVER_ONLY';
 end if;
 if p_user_id is null or p_phone is null or length(trim(p_phone)) < 5
    or p_proposal_id is null or length(p_proposal_id)>160
    or p_expected_revision is null or p_expected_revision < 0
    or p_idempotency_key is null then raise exception 'DFL_BOT_INVALID_AUTHORIZATION'; end if;
 if p_type not in ('income','expense') then raise exception 'DFL_BOT_UNSUPPORTED_TYPE'; end if;
 -- A sessao e bloqueada ate o fim da transacao. Em erro, lock e alteracoes sao revertidos.
 select * into v_session from public.bot_sessions where phone=p_phone for update;
 if not found or v_session.step <> 'TX_CONFIRM' then raise exception 'DFL_BOT_SESSION_CHANGED'; end if;
 v_current := coalesce(nullif(v_session.temp_data->>'proposal_revision','')::integer,0);
 v_proposal := v_session.temp_data->>'proposal_id';
 if v_current<>p_expected_revision or v_proposal is distinct from p_proposal_id
    then raise exception 'DFL_BOT_STALE_PROPOSAL'; end if;
 if v_session.temp_data->>'consumed_at' is not null then raise exception 'DFL_BOT_ALREADY_CONSUMED'; end if;
 -- Validacao de snapshot. Nao confiar so em parametros enviados ao wrapper.
 if v_session.temp_data->>'type' is distinct from p_type
    or (v_session.temp_data->>'amount')::numeric is distinct from p_amount
    or v_session.temp_data->>'description' is distinct from p_description
    or v_session.temp_data->>'context' is distinct from p_context
    or (v_session.temp_data->>'date')::date is distinct from p_date
    then raise exception 'DFL_BOT_PROPOSAL_CHANGED'; end if;
 -- A funcao financeira existente valida propriedade da conta/categoria e idempotencia.
 v_result := public.bot_record_transaction(p_user_id,p_account_id,p_type,p_amount,
    p_description,p_context,p_category_id,p_idempotency_key,p_date);
 update public.bot_sessions
 set step='TX_SETTLE', temp_data=jsonb_set(v_session.temp_data,'{consumed_at}',to_jsonb(now()::text),true)
 where phone=p_phone;
 return v_result || jsonb_build_object('proposal_revision',v_current,'proposal_id',v_proposal);
end;
$$;
revoke all on function public.dfl_bot_commit_proposal_r142(uuid,text,integer,text,uuid,text,numeric,text,text,uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.dfl_bot_commit_proposal_r142(uuid,text,integer,text,uuid,text,numeric,text,text,uuid,uuid,date) to service_role;
