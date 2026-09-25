-- V40.1 already applied remotely.
-- Optimizes remaining RLS auth.uid() calls using initplan-friendly (select auth.uid()).
-- CRUD semantics and policy names are preserved.

alter policy "Users can view their own credit cards" on public.credit_cards using ((select auth.uid()) = user_id);
alter policy "Users can insert their own credit cards" on public.credit_cards with check ((select auth.uid()) = user_id);
alter policy "Users can update their own credit cards" on public.credit_cards using ((select auth.uid()) = user_id);
alter policy "Users can delete their own credit cards" on public.credit_cards using ((select auth.uid()) = user_id);

alter policy "Usuário vê seus orçamentos" on public.budgets using ((select auth.uid()) = user_id);
alter policy "Usuário cria seus orçamentos" on public.budgets with check ((select auth.uid()) = user_id);
alter policy "Usuário atualiza seus orçamentos" on public.budgets using ((select auth.uid()) = user_id);
alter policy "Usuário deleta seus orçamentos" on public.budgets using ((select auth.uid()) = user_id);

alter policy "Usuário vê suas assinaturas" on public.subscriptions using ((select auth.uid()) = user_id);
alter policy "Usuário cria suas assinaturas" on public.subscriptions with check ((select auth.uid()) = user_id);
alter policy "Usuário atualiza suas assinaturas" on public.subscriptions using ((select auth.uid()) = user_id);
alter policy "Usuário deleta suas assinaturas" on public.subscriptions using ((select auth.uid()) = user_id);

alter policy "Usuário pode ver seus financiamentos" on public.financings using ((select auth.uid()) = user_id);
alter policy "Usuário pode criar financiamentos" on public.financings with check ((select auth.uid()) = user_id);
alter policy "Usuário pode atualizar seus financiamentos" on public.financings using ((select auth.uid()) = user_id);
alter policy "Usuário pode deletar seus financiamentos" on public.financings using ((select auth.uid()) = user_id);

alter policy "Usuário pode ver seus abatimentos" on public.financing_abatements using ((select auth.uid()) = (select financings.user_id from public.financings where financings.id = financing_abatements.financing_id));
alter policy "Usuário pode criar abatimentos" on public.financing_abatements with check ((select auth.uid()) = (select financings.user_id from public.financings where financings.id = financing_abatements.financing_id));
alter policy "Usuário pode atualizar seus abatimentos" on public.financing_abatements using ((select auth.uid()) = (select financings.user_id from public.financings where financings.id = financing_abatements.financing_id));
alter policy "Usuário pode deletar seus abatimentos" on public.financing_abatements using ((select auth.uid()) = (select financings.user_id from public.financings where financings.id = financing_abatements.financing_id));

alter policy "Usuário vê próprias leituras" on public.notification_reads using ((select auth.uid()) = user_id);
alter policy "Usuário insere próprias leituras" on public.notification_reads with check ((select auth.uid()) = user_id);
alter policy "Usuário deleta próprias leituras" on public.notification_reads using ((select auth.uid()) = user_id);
alter policy "Usuário vê próprios arquivos" on public.notification_archives using ((select auth.uid()) = user_id);
alter policy "Usuário insere próprios arquivos" on public.notification_archives with check ((select auth.uid()) = user_id);
alter policy "Usuário deleta próprios arquivos" on public.notification_archives using ((select auth.uid()) = user_id);

alter policy "Usuário vê próprio layout" on public.home_layout using ((select auth.uid()) = user_id);
alter policy "Usuário insere próprio layout" on public.home_layout with check ((select auth.uid()) = user_id);
alter policy "Usuário atualiza próprio layout" on public.home_layout using ((select auth.uid()) = user_id);

alter policy "Users can manage own loans" on public.loans using ((select auth.uid()) = user_id);
alter policy "Users can manage own loan repayments" on public.loan_repayments using (exists (select 1 from public.loans where loans.id=loan_repayments.loan_id and loans.user_id=(select auth.uid())));

alter policy "Users can view own phone" on public.user_phones using ((select auth.uid()) = user_id);
alter policy "Users can view own whatsapp messages" on public.whatsapp_messages using ((select auth.uid()) = user_id);

alter policy "Usuários visualizam suas faturas" on public.credit_invoices using (user_id = (select auth.uid()));
alter policy "Usuários criam suas faturas" on public.credit_invoices with check (user_id = (select auth.uid()));
alter policy "Usuários atualizam suas faturas" on public.credit_invoices using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "Usuários deletam suas faturas" on public.credit_invoices using (user_id = (select auth.uid()));

alter policy "Usuários visualizam suas importações" on public.invoice_imports using (user_id = (select auth.uid()));
alter policy "Usuários criam suas importações" on public.invoice_imports with check (user_id = (select auth.uid()));
alter policy "Usuários deletam suas importações" on public.invoice_imports using (user_id = (select auth.uid()));

alter policy "Usuários veem suas notificações" on public.notifications using (user_id = (select auth.uid()));
alter policy "Usuários criam suas notificações" on public.notifications with check (user_id = (select auth.uid()));
alter policy "Usuários atualizam suas notificações" on public.notifications using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "Usuários deletam suas notificações" on public.notifications using (user_id = (select auth.uid()));

alter policy "chat_sessions_select_own" on public.chat_sessions using ((select auth.uid()) = user_id);
alter policy "chat_sessions_insert_own" on public.chat_sessions with check ((select auth.uid()) = user_id);
alter policy "chat_sessions_update_own" on public.chat_sessions using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "chat_sessions_delete_own" on public.chat_sessions using ((select auth.uid()) = user_id);
alter policy "chat_history_select_own" on public.chat_history using ((select auth.uid()) = user_id);
alter policy "chat_history_insert_own" on public.chat_history with check ((select auth.uid()) = user_id);
alter policy "chat_history_update_own" on public.chat_history using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "chat_history_delete_own" on public.chat_history using ((select auth.uid()) = user_id);
