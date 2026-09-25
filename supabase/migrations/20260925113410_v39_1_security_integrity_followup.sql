-- V39.1 — advisor follow-up applied immediately after V39.
revoke execute on function public.create_default_categories() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.reconcile_imported_transactions(uuid,text,jsonb) security invoker;
revoke execute on function public.reconcile_imported_transactions(uuid,text,jsonb) from public, anon;
grant execute on function public.reconcile_imported_transactions(uuid,text,jsonb) to authenticated;
alter function public.reconcile_imported_transactions(uuid,text,jsonb) set search_path = public, pg_temp;

drop index if exists public.idx_budgets_category_id;
drop index if exists public.idx_categories_parent_id;
drop index if exists public.idx_credit_invoices_credit_card_id;
drop index if exists public.idx_financing_abatements_financing_id;
drop index if exists public.idx_goal_deposits_goal_id;
drop index if exists public.idx_transactions_contact_id;
drop index if exists public.idx_transactions_invoice_id;

create index if not exists idx_accounts_user_id on public.accounts(user_id);
create index if not exists idx_chat_messages_user_id on public.chat_messages(user_id);
create index if not exists idx_credit_cards_user_id on public.credit_cards(user_id);
create index if not exists idx_notification_archives_user_id on public.notification_archives(user_id);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_tags_user_id on public.tags(user_id);
create index if not exists idx_user_phones_user_id on public.user_phones(user_id);
