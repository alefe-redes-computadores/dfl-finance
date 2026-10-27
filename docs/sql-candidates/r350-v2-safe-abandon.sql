-- R350: complemento a R219+R347; nao executar isoladamente em producao.
-- Permite descartar sessao congelada e nao consumida APENAS se nenhum ledger
-- corresponde a usuario + idempotency_key. Commit concorrente segura row lock.
-- Nao altera saldo nem cria lancamento.
begin;
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
commit;
