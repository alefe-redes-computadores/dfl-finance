-- V44 — server-only RLS contracts
-- Migration remota já aplicada: 20260925123518_v44_server_only_rls_contracts
-- Não executar db push a partir deste script.

revoke all on table public.bot_sessions from anon, authenticated;
revoke all on table public.dfl_messaging_outbox from anon, authenticated;
revoke all on table public.scenarios from anon, authenticated;

drop policy if exists "server only deny clients v44" on public.bot_sessions;
create policy "server only deny clients v44"
on public.bot_sessions
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "server only deny clients v44" on public.dfl_messaging_outbox;
create policy "server only deny clients v44"
on public.dfl_messaging_outbox
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists "server only deny clients v44" on public.scenarios;
create policy "server only deny clients v44"
on public.scenarios
for all
to anon, authenticated
using (false)
with check (false);
