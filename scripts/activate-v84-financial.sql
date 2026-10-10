-- ADMIN ONLY. Run AFTER the new PWA/backend are verified and legacy queues reviewed.
-- This deliberately blocks independent financial writes by older PWA/APK clients.
begin;
do $$ begin
  if to_regprocedure('public.dfl_commit_financial_batch(uuid,jsonb)') is null then
    raise exception 'V84 RPC ausente: ativação cancelada';
  end if;
end $$;
update public.finance_sync_settings set enforce_atomic=true where singleton=true;
commit;
select enforce_atomic from public.finance_sync_settings where singleton=true;
