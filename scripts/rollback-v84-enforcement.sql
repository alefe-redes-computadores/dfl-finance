-- Emergency compatibility rollback ONLY; does not undo committed money or schema.
-- Re-enables legacy direct writes, so use only in a monitored recovery window.
begin;
update public.finance_sync_settings set enforce_atomic=false where singleton=true;
commit;
select enforce_atomic from public.finance_sync_settings where singleton=true;
