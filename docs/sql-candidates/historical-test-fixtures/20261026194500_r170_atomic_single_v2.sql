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
