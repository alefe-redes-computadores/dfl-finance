-- V40 already applied remotely: core RLS consolidation.
-- Keep this file as the repository's schema history.
-- Exact remote migration name: v40_rls_consolidation_core

-- Accounts
drop policy if exists "Permitir tudo em contas" on public.accounts;
drop policy if exists "Permitir_Tudo_Accounts" on public.accounts;
drop policy if exists "Permitir_Tudo_accounts" on public.accounts;
drop policy if exists "own accounts" on public.accounts;
drop policy if exists "Permitir_Delete_Acc" on public.accounts;
drop policy if exists "Usuário deleta suas contas" on public.accounts;
drop policy if exists "Usuários podem deletar suas próprias contas" on public.accounts;
drop policy if exists "Permitir_Insert_Acc" on public.accounts;
drop policy if exists "Usuário insere suas contas" on public.accounts;
drop policy if exists "Usuário pode inserir suas próprias contas" on public.accounts;
drop policy if exists "Usuários podem inserir suas próprias contas" on public.accounts;
drop policy if exists "Permitir_Select_Acc" on public.accounts;
drop policy if exists "Usuário pode ler suas próprias contas" on public.accounts;
drop policy if exists "Usuário vê suas contas" on public.accounts;
drop policy if exists "Usuários podem ver suas próprias contas" on public.accounts;
drop policy if exists "Permitir_Update_Acc" on public.accounts;
drop policy if exists "Usuário atualiza suas contas" on public.accounts;
drop policy if exists "Usuário pode atualizar suas próprias contas" on public.accounts;
create policy "own accounts v40" on public.accounts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Categories
drop policy if exists "Acesso_Privado_Categories" on public.categories;
drop policy if exists "Permitir tudo para o próprio usuário nas categorias" on public.categories;
drop policy if exists "Permitir_Tudo_categories" on public.categories;
drop policy if exists "own categories" on public.categories;
drop policy if exists "Usuário deleta suas categorias" on public.categories;
drop policy if exists "Usuário insere suas categorias" on public.categories;
drop policy if exists "Apenas o dono pode ver suas categorias" on public.categories;
drop policy if exists "Usuário vê suas categorias" on public.categories;
drop policy if exists "Usuário atualiza suas categorias" on public.categories;
create policy "own categories v40" on public.categories for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Chat messages
drop policy if exists "Usuário insere suas mensagens" on public.chat_messages;
drop policy if exists "user_insert" on public.chat_messages;
drop policy if exists "Usuário vê suas próprias mensagens" on public.chat_messages;
drop policy if exists "user_messages" on public.chat_messages;
create policy "own chat messages select v40" on public.chat_messages for select to authenticated using ((select auth.uid()) = user_id);
create policy "own chat messages insert v40" on public.chat_messages for insert to authenticated with check ((select auth.uid()) = user_id);

-- Goals
drop policy if exists "Usuário deleta suas metas" on public.goals;
drop policy if exists "Usuários deletam suas metas" on public.goals;
drop policy if exists "Usuário cria suas metas" on public.goals;
drop policy if exists "Usuários criam suas metas" on public.goals;
drop policy if exists "Usuário vê suas metas" on public.goals;
drop policy if exists "Usuários veem suas metas" on public.goals;
drop policy if exists "Usuário atualiza suas metas" on public.goals;
drop policy if exists "Usuários atualizam suas metas" on public.goals;
create policy "own goals v40" on public.goals for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Goal deposits
drop policy if exists "Usuário gerencia depósitos" on public.goal_deposits;
drop policy if exists "Usuário deleta seus depósitos" on public.goal_deposits;
drop policy if exists "Usuário cria seus depósitos" on public.goal_deposits;
drop policy if exists "Usuário vê seus depósitos" on public.goal_deposits;
create policy "own goal deposits v40" on public.goal_deposits for all to authenticated
using (exists (select 1 from public.goals where goals.id=goal_deposits.goal_id and goals.user_id=(select auth.uid())))
with check (exists (select 1 from public.goals where goals.id=goal_deposits.goal_id and goals.user_id=(select auth.uid())));

-- Single ownership families
drop policy if exists "Permitir tudo em tags" on public.tags;
create policy "own tags v40" on public.tags for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Permitir_Tudo_Transactions" on public.transactions;
create policy "own transactions v40" on public.transactions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "user_settings_policy" on public.user_settings;
create policy "own user settings v40" on public.user_settings for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "own profile" on public.profiles;
create policy "own profile v40" on public.profiles for all to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
drop policy if exists "own debts" on public.debts;
create policy "own debts v40" on public.debts for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "Usuários gerenciam suas regras" on public.categorization_rules;
create policy "own categorization rules v40" on public.categorization_rules for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "Usuários gerenciam seus contatos" on public.contacts;
create policy "own contacts v40" on public.contacts for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
drop policy if exists "Usuários gerenciam suas inscrições" on public.push_subscriptions;
create policy "own push subscriptions v40" on public.push_subscriptions for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
