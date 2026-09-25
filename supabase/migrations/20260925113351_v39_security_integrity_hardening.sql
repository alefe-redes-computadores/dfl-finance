-- V39 — applied to Supabase project DFL - Finance on 2026-09-25.
alter view public.account_transactions_view set (security_invoker = true);
alter view public.projected_daily_balance set (security_invoker = true);

alter function public.create_default_categories() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.transactions_ordering() set search_path = public, pg_temp;
alter function public.update_available_limit() set search_path = public, pg_temp;

drop policy if exists "Permitir_Tudo_Tags" on public.tags;
drop policy if exists "Permitir_Tudo_tags" on public.tags;
drop policy if exists "Usuário atualiza suas tags" on public.tags;
drop policy if exists "Usuário deleta suas tags" on public.tags;
drop policy if exists "Usuário insere suas tags" on public.tags;
drop policy if exists "Usuário vê suas tags" on public.tags;

drop policy if exists "Permitir tudo para o próprio usuário nas transações" on public.transactions;
drop policy if exists "Permitir_Delete" on public.transactions;
drop policy if exists "Permitir_Insert" on public.transactions;
drop policy if exists "Permitir_Select" on public.transactions;
drop policy if exists "Permitir_Tudo_transactions" on public.transactions;
drop policy if exists "Permitir_Update" on public.transactions;
drop policy if exists "own transactions" on public.transactions;

drop policy if exists "Usuário insere suas configurações" on public.user_settings;
drop policy if exists "Usuário vê suas configurações" on public.user_settings;

create index if not exists idx_budgets_category_id on public.budgets(category_id);
create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_categories_user_id on public.categories(user_id);
create index if not exists idx_categorization_rules_category_id on public.categorization_rules(category_id);
create index if not exists idx_chat_history_session_id on public.chat_history(session_id);
create index if not exists idx_credit_cards_payment_account_id on public.credit_cards(payment_account_id);
create index if not exists idx_credit_invoices_credit_card_id on public.credit_invoices(credit_card_id);
create index if not exists idx_debts_account_id on public.debts(account_id);
create index if not exists idx_debts_category_id on public.debts(category_id);
create index if not exists idx_debts_contact_id on public.debts(contact_id);
create index if not exists idx_financing_abatements_account_id on public.financing_abatements(account_id);
create index if not exists idx_financing_abatements_financing_id on public.financing_abatements(financing_id);
create index if not exists idx_financings_account_id on public.financings(account_id);
create index if not exists idx_financings_category_id on public.financings(category_id);
create index if not exists idx_goal_deposits_account_origin_id on public.goal_deposits(account_origin_id);
create index if not exists idx_goal_deposits_goal_id on public.goal_deposits(goal_id);
create index if not exists idx_goals_account_id on public.goals(account_id);
create index if not exists idx_loan_repayments_dest_transaction_id on public.loan_repayments(dest_transaction_id);
create index if not exists idx_loan_repayments_loan_id on public.loan_repayments(loan_id);
create index if not exists idx_loan_repayments_source_transaction_id on public.loan_repayments(source_transaction_id);
create index if not exists idx_subscriptions_account_id on public.subscriptions(account_id);
create index if not exists idx_subscriptions_category_id on public.subscriptions(category_id);
create index if not exists idx_transactions_account_id on public.transactions(account_id);
create index if not exists idx_transactions_category_id on public.transactions(category_id);
create index if not exists idx_transactions_contact_id on public.transactions(contact_id);
create index if not exists idx_transactions_credit_card_id on public.transactions(credit_card_id);
create index if not exists idx_transactions_debt_id on public.transactions(debt_id);
create index if not exists idx_transactions_financing_id on public.transactions(financing_id);
create index if not exists idx_transactions_invoice_id on public.transactions(invoice_id);
create index if not exists idx_transactions_linked_transaction_id on public.transactions(linked_transaction_id);
create index if not exists idx_transactions_loan_id on public.transactions(loan_id);
create index if not exists idx_transactions_to_account_id on public.transactions(to_account_id);
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_whatsapp_messages_transaction_id on public.whatsapp_messages(transaction_id);
