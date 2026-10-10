-- Read-only. Export privately; never attach financial rows or credentials to logs.
select current_database(),version();
select table_name,column_name,data_type,is_nullable
from information_schema.columns where table_schema='public'
and table_name in ('accounts','transactions','loans','financings','profiles','credit_cards','credit_invoices')
order by table_name,ordinal_position;
select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid)
from pg_constraint where conrelid in ('public.transactions'::regclass,'public.loans'::regclass,'public.financings'::regclass);
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename in
('accounts','transactions','credit_cards','credit_invoices','profiles','loans','financings');
select type,status,affects_balance,count(*)
from public.transactions group by type,status,affects_balance order by type,status;
select count(*) as legacy_transfer_legs from public.transactions where type='transfer';
select p.proname,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
('bot_settle_transaction','bot_record_transfer','bot_record_debt_payment','update_available_limit');
