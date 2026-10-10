-- V84: additive contracts + atomic, version-checked commit. No balance rewrite.
begin;

alter table public.transactions
  add column if not exists cash_delta numeric,
  add column if not exists due_date date,
  add column if not exists paid boolean,
  add column if not exists paid_date date,
  add column if not exists number integer,
  add column if not exists installment_number integer,
  add column if not exists goal_id uuid references public.goals(id) on delete set null,
  add column if not exists transfer_direction text check (transfer_direction in ('out','in'));
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check
  check (type in ('income','expense','transfer','sangria','loan_payment','financing_installment'));
-- Reciprocal reimbursement links must be checked at transaction end.
alter table public.transactions alter constraint transactions_linked_transaction_id_fkey deferrable initially immediate;

alter table public.loans
  add column if not exists context text check (context in ('dfl','personal')),
  add column if not exists direction text check (direction in ('lent','borrowed')),
  add column if not exists lender text,
  add column if not exists date date,
  add column if not exists amount numeric,
  add column if not exists interest_rate numeric,
  add column if not exists notes text;
-- External lending does not have an internal destination context. Preserve the
-- legacy fields, but do not invent an internal destination for an external loan.
alter table public.loans alter column source_context drop not null;
alter table public.loans alter column dest_context drop not null;
alter table public.loans drop constraint if exists loans_status_check;
alter table public.loans add constraint loans_status_check
  check (status in ('active','completed','cancelled','paid','overdue'));
alter table public.financings
  add column if not exists description text,
  add column if not exists installments_count integer,
  add column if not exists installment_amount numeric,
  add column if not exists remaining_amount numeric,
  add column if not exists total_amount numeric,
  add column if not exists interest_rate numeric,
  add column if not exists bank text,
  add column if not exists asset_type text,
  add column if not exists asset text,
  add column if not exists start_date date,
  add column if not exists first_due_date date,
  add column if not exists notes text;
alter table public.financings drop constraint if exists financings_status_check;
alter table public.financings add constraint financings_status_check
  check (status in ('active','archived','paid','overdue'));
alter table public.chat_history add column if not exists updated_at timestamptz default now();

create table if not exists public.finance_sync_batches (
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id,batch_id)
);
alter table public.finance_sync_batches enable row level security;
revoke all on public.finance_sync_batches from public, anon, authenticated;
grant select,insert on public.finance_sync_batches to authenticated;
grant all on public.finance_sync_batches to service_role;
create policy finance_sync_batches_select on public.finance_sync_batches for select to authenticated
  using (user_id = (select auth.uid()));
create policy finance_sync_batches_insert on public.finance_sync_batches for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Pure helpers express the cash contract separately from economic metrics.
create or replace function public.dfl_transaction_cash_effect(r jsonb)
returns numeric language plpgsql immutable security invoker set search_path='' as $$
declare amount numeric:=round((r->>'amount')::numeric,2);
begin
 if r is null or r->>'status' is distinct from 'done' or r->>'account_id' is null then return 0; end if;
 if r->>'type'='transfer' then
   if r->>'transfer_direction'='out' then return -amount; end if;
   if r->>'transfer_direction'='in' then return amount; end if;
   return null;
 end if;
 if r->>'type'='loan_payment' then return (r->>'cash_delta')::numeric; end if;
 if r->>'type'='financing_installment' then return -amount; end if;
 if r->>'type'='income' and coalesce((r->>'affects_balance')::boolean,true) then return amount; end if;
 if r->>'type' in ('expense','sangria') and coalesce((r->>'affects_balance')::boolean,true) then return -amount; end if;
 if r->>'type'='expense' and r->>'invoice_id' is not null then return -amount; end if;
 return coalesce((r->>'cash_delta')::numeric,0);
end;
$$;
create or replace function public.dfl_account_metadata(r jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_object_agg(k,r->k) from unnest(array['name','bank_slug','context','color','allow_negative','order','type','is_archived','bank','icon']) k;
$$;
create or replace function public.dfl_transaction_cash_identity(r jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_object_agg(k,r->k) from unnest(array['type','status','amount','account_id','affects_balance','invoice_id','loan_id','financing_id','cash_delta','transfer_direction']) k;
$$;
revoke all on function public.dfl_transaction_cash_effect(jsonb),public.dfl_account_metadata(jsonb),public.dfl_transaction_cash_identity(jsonb) from public,anon;
grant execute on function public.dfl_transaction_cash_effect(jsonb),public.dfl_account_metadata(jsonb),public.dfl_transaction_cash_identity(jsonb) to authenticated,service_role;

create or replace function public.dfl_commit_financial_batch(p_batch_id uuid, p_items jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  receipt public.finance_sync_batches%rowtype;
  item jsonb;
  row_data jsonb;
  payload jsonb;
  table_name text;
  row_id text;
  id_type text;
  operation text;
  expected_version timestamptz;
  columns_sql text;
  values_sql text;
  assignments_sql text;
  key text;
  ref_table text;
  ref_id text;
  exists_owned boolean;
  versions jsonb := '{}'::jsonb;
  accounts_result jsonb := '{}'::jsonb;
  account_snapshots jsonb := '{}'::jsonb;
  ledger_deltas jsonb := '{}'::jsonb;
  old_effect numeric;
  new_effect numeric;
  account_delta numeric;
  base_balance numeric;
  output jsonb;
  duplicate_count integer;
  affected integer;
  touched_transfer_groups uuid[] := array[]::uuid[];
  allowed constant text[] := array['categories','accounts','contacts','credit_cards','debts','loans','financings',
    'subscriptions','tags','budgets','goals','chat_sessions','credit_invoices','transactions','notifications','chat_history'];
begin
  if owner_id is null then raise exception 'DFL_AUTH_REQUIRED'; end if;
  if p_batch_id is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 5000 or octet_length(p_items::text) > 8388608 then
    raise exception 'DFL_INVALID_BATCH';
  end if;
  perform set_config('dfl.financial_batch','on',true);
  -- Serializes this API's clients; row locks below also protect against bot SQL.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,0));
  select * into receipt from public.finance_sync_batches where user_id=owner_id and batch_id=p_batch_id;
  if found then
    if receipt.request_hash <> md5(p_items::text) then raise exception 'DFL_IDEMPOTENCY_REUSED'; end if;
    return receipt.result;
  end if;
  select count(*)-count(distinct (value->>'table',value->>'record_id')) into duplicate_count
    from jsonb_array_elements(p_items);
  if duplicate_count <> 0 then raise exception 'DFL_DUPLICATE_BATCH_RECORD'; end if;

  -- Validate and lock every version BEFORE changing any table.
  for item in select value from jsonb_array_elements(p_items) order by value->>'table',value->>'record_id' loop
    table_name := item->>'table'; row_id := item->>'record_id'; operation := item->>'operation';
    if not (table_name = any(allowed)) or operation not in ('create','update','delete')
      or row_id is null or not (item ? 'expected_updated_at') then raise exception 'DFL_INVALID_BATCH_ITEM'; end if;
    select format_type(a.atttypid,a.atttypmod) into id_type from pg_catalog.pg_attribute a
      where a.attrelid=format('public.%I',table_name)::regclass and a.attname='id';
    execute format('select to_jsonb(t) from public.%I t where id=$1::%s and user_id=$2 for update',table_name,id_type)
      into row_data using row_id,owner_id;
    if table_name='transactions' then
      if row_data->>'transfer_group_id' is not null then
        touched_transfer_groups:=array_append(touched_transfer_groups,(row_data->>'transfer_group_id')::uuid);
      end if;
      if item->'data'->>'transfer_group_id' is not null then
        touched_transfer_groups:=array_append(touched_transfer_groups,(item->'data'->>'transfer_group_id')::uuid);
      end if;
    end if;
    expected_version := (item->>'expected_updated_at')::timestamptz;
    if row_data is null then
      if expected_version is not null or operation='update' then
        raise exception 'DFL_SYNC_CONFLICT:%/% (missing)',table_name,row_id;
      end if;
    else
      if expected_version is null then raise exception 'DFL_SYNC_CONFLICT:%/% (version)',table_name,row_id; end if;
      if (row_data->>'updated_at')::timestamptz is distinct from expected_version then
        -- Only proved additive cash may rebase. Metadata edits and unknown
        -- legacy effects remain conflicts; a timestamp never wins by itself.
        if table_name<>'accounts' or operation<>'update' or not (item ? 'base_balance')
          or public.dfl_account_metadata(row_data) is distinct from item->'base_metadata'
          or public.dfl_account_metadata(item->'data') is distinct from item->'base_metadata' then
          raise exception 'DFL_SYNC_CONFLICT:%/% (version)',table_name,row_id;
        end if;
      end if;
    end if;
    if table_name='accounts' then account_snapshots:=account_snapshots || jsonb_build_object(row_id,row_data); end if;
    if table_name='transactions' then
      old_effect:=public.dfl_transaction_cash_effect(row_data);
      new_effect:=case when operation='delete' then 0 else public.dfl_transaction_cash_effect(item->'data') end;
      if old_effect is null or new_effect is null then
        if operation<>'delete' and public.dfl_transaction_cash_identity(row_data)=public.dfl_transaction_cash_identity(item->'data') then
          old_effect:=0;new_effect:=0;
        else raise exception 'DFL_LEGACY_REVIEW:unknown cash effect'; end if;
      end if;
      if row_data->>'account_id' is not null then
        key:=row_data->>'account_id';
        ledger_deltas:=ledger_deltas || jsonb_build_object(key,coalesce((ledger_deltas->>key)::numeric,0)-old_effect);
      end if;
      if operation<>'delete' and item->'data'->>'account_id' is not null then
        key:=item->'data'->>'account_id';
        ledger_deltas:=ledger_deltas || jsonb_build_object(key,coalesce((ledger_deltas->>key)::numeric,0)+new_effect);
      end if;
    end if;
    if operation <> 'delete' then
      payload := item->'data';
      if jsonb_typeof(payload) <> 'object' or payload->>'id' is distinct from row_id
        or payload->>'user_id' is distinct from owner_id::text then raise exception 'DFL_INVALID_OWNER'; end if;
      for key in select jsonb_object_keys(payload) loop
        if not exists(select 1 from pg_catalog.pg_attribute where attrelid=format('public.%I',table_name)::regclass
          and attname=key and attnum>0 and not attisdropped) then raise exception 'DFL_UNKNOWN_COLUMN:%/%',table_name,key; end if;
      end loop;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_items) where value->>'table'='accounts' and value->>'operation'='update' loop
    row_id:=item->>'record_id';
    if item->>'base_balance' is null then raise exception 'DFL_LEGACY_REVIEW:missing balance base'; end if;
    base_balance:=(item->>'base_balance')::numeric;
    account_delta:=round((item->'data'->>'balance')::numeric-base_balance,2);
    if account_delta is distinct from round(coalesce((ledger_deltas->>row_id)::numeric,0),2) then
      raise exception 'DFL_CASH_TRAIL_MISMATCH:%',row_id;
    end if;
  end loop;
  for key in select jsonb_object_keys(ledger_deltas) loop
    if (ledger_deltas->>key)::numeric<>0 and not exists(select 1 from jsonb_array_elements(p_items)
      where value->>'table'='accounts' and value->>'record_id'=key and value->>'operation' in ('create','update')) then
      raise exception 'DFL_ACCOUNT_EFFECT_MISSING:%',key;
    end if;
  end loop;
  set constraints public.transactions_linked_transaction_id_fkey deferred;

  -- The API owns dependency order. Clients cannot delete parents before children.
  for item in select value from jsonb_array_elements(p_items) where value->>'operation'<>'delete'
    order by array_position(allowed,value->>'table'),value->>'record_id' loop
    table_name := item->>'table'; row_id := item->>'record_id';
    payload := (item->'data') || jsonb_build_object('updated_at',clock_timestamp());
    if table_name='accounts' and item->>'operation'='update' then
      base_balance:=(item->>'base_balance')::numeric;
      account_delta:=round((payload->>'balance')::numeric-base_balance,2);
      payload:=payload || jsonb_build_object('balance',round((account_snapshots->row_id->>'balance')::numeric+account_delta,2));
    end if;
    if table_name='loans' and not (payload ? 'total_amount') and payload ? 'amount' then
      payload := payload || jsonb_build_object('total_amount',payload->'amount');
    end if;
    if table_name='financings' and not (payload ? 'outstanding_balance') and payload ? 'remaining_amount' then
      payload := payload || jsonb_build_object('outstanding_balance',payload->'remaining_amount');
    end if;
    select string_agg(format('%I',k),',' order by k),string_agg(format('r.%I',k),',' order by k),
      string_agg(format('%1$I=excluded.%1$I',k),',' order by k) filter(where k not in ('id','user_id'))
      into columns_sql,values_sql,assignments_sql from jsonb_object_keys(payload) k;
    execute format('insert into public.%1$I (%2$s) select %3$s from jsonb_populate_record(null::public.%1$I,$1) r '
      || 'on conflict(id) do update set %4$s where %1$I.user_id=$2',table_name,columns_sql,values_sql,assignments_sql)
      using payload,owner_id;
    get diagnostics affected = row_count;
    if affected<>1 then raise exception 'DFL_WRITE_NOT_CONFIRMED'; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_items) where value->>'operation'='delete'
    order by array_position(allowed,value->>'table') desc,value->>'record_id' loop
    table_name:=item->>'table'; row_id:=item->>'record_id';
    select format_type(a.atttypid,a.atttypmod) into id_type from pg_catalog.pg_attribute a
      where a.attrelid=format('public.%I',table_name)::regclass and a.attname='id';
    execute format('delete from public.%I where id=$1::%s and user_id=$2',table_name,id_type) using row_id,owner_id;
  end loop;

  -- Foreign keys alone do not prove ownership of referenced rows.
  for item in select value from jsonb_array_elements(p_items) where value->>'operation'<>'delete' loop
    table_name:=item->>'table'; row_id:=item->>'record_id'; payload:=item->'data';
    for key,ref_table in select * from (values ('account_id','accounts'),('to_account_id','accounts'),
      ('payment_account_id','accounts'),('category_id','categories'),('credit_card_id','credit_cards'),
      ('invoice_id','credit_invoices'),('contact_id','contacts'),('debt_id','debts'),('loan_id','loans'),
      ('financing_id','financings'),('goal_id','goals'),('linked_transaction_id','transactions'),
      ('parent_id','categories'),('tag_id','tags'),('session_id','chat_sessions')) refs loop
      ref_id:=payload->>key;
      if ref_id is not null and ref_id<>'' then
        execute format('select exists(select 1 from public.%I where id=$1::uuid and user_id=$2)',ref_table)
          into exists_owned using ref_id,owner_id;
        if not exists_owned then raise exception 'DFL_REFERENCE_NOT_OWNED:%/%',table_name,key; end if;
      end if;
    end loop;
    if jsonb_typeof(payload->'tag_ids')='array' then
      for ref_id in select jsonb_array_elements_text(payload->'tag_ids') loop
        if not exists(select 1 from public.tags where id=ref_id::uuid and user_id=owner_id) then
          raise exception 'DFL_REFERENCE_NOT_OWNED:tag_ids'; end if;
      end loop;
    end if;
  end loop;
  -- An existing two-leg group cannot be reduced to one leg by a generic delete.
  if exists(select 1 from public.transactions t where t.user_id=owner_id and t.transfer_group_id in
    (select unnest(touched_transfer_groups))
    group by t.transfer_group_id having count(*)<>2 or min(t.amount)<>max(t.amount) or min(t.amount)<=0
      or count(*) filter(where t.type='transfer' and t.status='done')<>2
      or count(distinct t.account_id)<>2
      or count(t.transfer_direction) not in (0,2)
      or (count(t.transfer_direction)=2 and (count(*) filter(where t.transfer_direction='out')<>1
        or count(*) filter(where t.transfer_direction='in')<>1))) then
    raise exception 'DFL_TRANSFER_GROUP_INCOMPLETE';
  end if;
  if exists(select 1 from public.transactions t where t.user_id=owner_id
    and t.transfer_group_id in (select unnest(touched_transfer_groups)) and not exists(
      select 1 from public.transactions counterpart where counterpart.user_id=owner_id
        and counterpart.transfer_group_id=t.transfer_group_id and counterpart.id<>t.id
        and counterpart.account_id=t.to_account_id and counterpart.to_account_id=t.account_id)) then
    raise exception 'DFL_TRANSFER_GROUP_INCOMPLETE:nonreciprocal';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    table_name:=item->>'table'; row_id:=item->>'record_id';
    select format_type(a.atttypid,a.atttypmod) into id_type from pg_catalog.pg_attribute a
      where a.attrelid=format('public.%I',table_name)::regclass and a.attname='id';
    execute format('select to_jsonb(t) from public.%I t where id=$1::%s and user_id=$2',table_name,id_type)
      into row_data using row_id,owner_id;
    if table_name='accounts' then accounts_result:=accounts_result || jsonb_build_object(row_id,row_data); end if;
    versions:=versions || jsonb_build_object(table_name || '/' || row_id,row_data->'updated_at');
  end loop;
  output:=jsonb_build_object('status','committed','batch_id',p_batch_id,'versions',versions,'accounts',accounts_result);
  insert into public.finance_sync_batches(user_id,batch_id,request_hash,result)
    values(owner_id,p_batch_id,md5(p_items::text),output);
  return output;
end;
$$;
revoke all on function public.dfl_commit_financial_batch(uuid,jsonb) from public,anon;
grant execute on function public.dfl_commit_financial_batch(uuid,jsonb) to authenticated;

-- Two-stage activation: install the RPC first, publish the new clients, then
-- turn enforcement on deliberately. Installing this migration alone preserves
-- compatibility with the currently published application.
create table public.finance_sync_settings (
  singleton boolean primary key default true check(singleton),
  enforce_atomic boolean not null default false
);
insert into public.finance_sync_settings(singleton,enforce_atomic) values(true,false);
alter table public.finance_sync_settings enable row level security;
revoke all on public.finance_sync_settings from public,anon,authenticated;
grant all on public.finance_sync_settings to service_role;
create or replace function public.dfl_atomic_finance_required()
returns boolean language sql stable security definer set search_path='' as $$
 select enforce_atomic from public.finance_sync_settings where singleton=true;
$$;
revoke all on function public.dfl_atomic_finance_required() from public,anon;
grant execute on function public.dfl_atomic_finance_required() to authenticated,service_role;

-- Old clients must not continue sending independent financial snapshots after
-- rollout. Reads are unchanged; service_role/bot keeps its server-side path.
do $$
declare t text;
begin
  foreach t in array array['accounts','transactions','credit_cards','credit_invoices','debts','loans','financings','contacts','goals'] loop
    execute format('create policy dfl_atomic_insert on public.%I as restrictive for insert to authenticated '
      || 'with check (not (select public.dfl_atomic_finance_required()) or (select current_setting(''dfl.financial_batch'',true)) = ''on'')',t);
    execute format('create policy dfl_atomic_update on public.%I as restrictive for update to authenticated '
      || 'using (not (select public.dfl_atomic_finance_required()) or (select current_setting(''dfl.financial_batch'',true)) = ''on'') '
      || 'with check (not (select public.dfl_atomic_finance_required()) or (select current_setting(''dfl.financial_batch'',true)) = ''on'')',t);
    execute format('create policy dfl_atomic_delete on public.%I as restrictive for delete to authenticated '
      || 'using (not (select public.dfl_atomic_finance_required()) or (select current_setting(''dfl.financial_batch'',true)) = ''on'')',t);
  end loop;
end;
$$;

-- Server versions never depend on a device clock, including updates made by
-- the existing bot and the credit-limit trigger.
create or replace function public.dfl_stamp_sync_version()
returns trigger language plpgsql security invoker set search_path='' as $$
begin new.updated_at:=clock_timestamp(); return new; end;
$$;
revoke all on function public.dfl_stamp_sync_version() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['categories','accounts','contacts','credit_cards','debts','loans','financings',
   'subscriptions','tags','budgets','goals','chat_sessions','credit_invoices','transactions','notifications','chat_history'] loop
   execute format('create trigger dfl_server_sync_version before insert or update on public.%I '
     || 'for each row execute function public.dfl_stamp_sync_version()',t);
 end loop;
end;
$$;

create or replace function public.dfl_protect_profile_role()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin') and
    ((tg_op='INSERT' and coalesce(new.is_admin,false)) or
     (tg_op='UPDATE' and new.is_admin is distinct from old.is_admin)) then
    raise exception 'Administrative role is server managed';
  end if;
  return new;
end;
$$;
create trigger dfl_profiles_role_guard before insert or update on public.profiles
  for each row execute function public.dfl_protect_profile_role();
revoke all on function public.dfl_protect_profile_role() from public,anon,authenticated;

-- Match the app's open-card obligation flag. Closed purchases must not keep
-- consuming available credit forever. Refresh both cards when a row moves.
create or replace function public.update_available_limit()
returns trigger language plpgsql security invoker set search_path='' as $$
declare card uuid; owner_id uuid; used_amount numeric;
begin
 owner_id:=coalesce(new.user_id,old.user_id);
 for card in select distinct x from unnest(array[new.credit_card_id,old.credit_card_id]) x where x is not null loop
   select coalesce(sum(case when type='income' then -amount when type='expense' then amount else 0 end),0)
     into used_amount from public.transactions
     where user_id=owner_id and credit_card_id=card and affects_balance is not true;
   update public.credit_cards set available_limit=limit_amount-used_amount where id=card and user_id=owner_id;
 end loop;
 return coalesce(new,old);
end;
$$;
revoke all on function public.update_available_limit() from public,anon,authenticated;

create table public.finance_push_deliveries (
  notification_id text not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null check (status in ('pending','sent','failed')),
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key(notification_id,subscription_id)
);
alter table public.finance_push_deliveries enable row level security;
revoke all on public.finance_push_deliveries from public,anon,authenticated;
grant all on public.finance_push_deliveries to service_role;
create or replace function public.dfl_claim_push_delivery(p_notification_id text,p_subscription_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare claimed text;
begin
  if not exists(select 1 from public.notifications n join public.push_subscriptions s on s.user_id=n.user_id
    where n.id=p_notification_id and s.id=p_subscription_id) then return false; end if;
  insert into public.finance_push_deliveries(notification_id,subscription_id,status)
    values(p_notification_id,p_subscription_id,'pending')
    on conflict(notification_id,subscription_id) do update set status='pending',claimed_at=clock_timestamp(),completed_at=null
      where finance_push_deliveries.status='failed' or
        (finance_push_deliveries.status='pending' and finance_push_deliveries.claimed_at<now()-interval '10 minutes')
    returning notification_id into claimed;
  return claimed is not null;
end;
$$;
revoke all on function public.dfl_claim_push_delivery(text,uuid) from public,anon,authenticated;
grant execute on function public.dfl_claim_push_delivery(text,uuid) to service_role;

commit;
