-- DFL Finance — G2.1 Supabase Schema Recovery
-- Execute no SQL Editor do Supabase antes de forçar a sincronização novamente.

begin;

-- ============================================================
-- ACCOUNTS
-- ============================================================
alter table if exists public.accounts
  add column if not exists bank text null;

-- ============================================================
-- CATEGORIES
-- ============================================================
alter table if exists public.categories
  add column if not exists order_index integer null;

-- Preenche somente registros sem ordem, sem sobrescrever ordem existente.
with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, context, type
      order by created_at nulls last, id
    ) - 1 as rn
  from public.categories
  where order_index is null
)
update public.categories c
set order_index = ranked.rn
from ranked
where c.id = ranked.id
  and c.order_index is null;

-- ============================================================
-- CHAT SESSIONS
-- ============================================================
create table if not exists public.chat_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_sessions_status_check
    check (status in ('active', 'archived'))
);

create index if not exists idx_chat_sessions_user_status
  on public.chat_sessions(user_id, status);

create index if not exists idx_chat_sessions_user_updated
  on public.chat_sessions(user_id, updated_at desc);

alter table public.chat_sessions enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'chat_sessions_select_own'
  ) then
    create policy chat_sessions_select_own
      on public.chat_sessions
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'chat_sessions_insert_own'
  ) then
    create policy chat_sessions_insert_own
      on public.chat_sessions
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'chat_sessions_update_own'
  ) then
    create policy chat_sessions_update_own
      on public.chat_sessions
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'chat_sessions'
      and policyname = 'chat_sessions_delete_own'
  ) then
    create policy chat_sessions_delete_own
      on public.chat_sessions
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- ============================================================
-- CHAT HISTORY
-- ============================================================
alter table if exists public.chat_history
  add column if not exists session_id uuid null;

do $$
begin
  if to_regclass('public.chat_history') is not null
     and not exists (
       select 1
       from pg_constraint
       where conname = 'chat_history_session_id_fkey'
         and conrelid = 'public.chat_history'::regclass
     ) then
    alter table public.chat_history
      add constraint chat_history_session_id_fkey
      foreign key (session_id)
      references public.chat_sessions(id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_chat_history_user_session
  on public.chat_history(user_id, session_id);

-- Mantém RLS da tabela existente; cria políticas somente se ainda não houver
-- políticas próprias com estes nomes.
alter table if exists public.chat_history enable row level security;

do $$
begin
  if to_regclass('public.chat_history') is not null then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'chat_history'
        and policyname = 'chat_history_select_own'
    ) then
      create policy chat_history_select_own
        on public.chat_history
        for select
        using (auth.uid() = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'chat_history'
        and policyname = 'chat_history_insert_own'
    ) then
      create policy chat_history_insert_own
        on public.chat_history
        for insert
        with check (auth.uid() = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'chat_history'
        and policyname = 'chat_history_update_own'
    ) then
      create policy chat_history_update_own
        on public.chat_history
        for update
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = 'chat_history'
        and policyname = 'chat_history_delete_own'
    ) then
      create policy chat_history_delete_own
        on public.chat_history
        for delete
        using (auth.uid() = user_id);
    end if;
  end if;
end $$;

commit;

-- ============================================================
-- VERIFICAÇÃO
-- ============================================================
select
  table_name,
  column_name,
  data_type
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'accounts' and column_name = 'bank')
    or
    (table_name = 'categories' and column_name = 'order_index')
    or
    (table_name = 'chat_history' and column_name = 'session_id')
    or
    table_name = 'chat_sessions'
  )
order by table_name, ordinal_position;
