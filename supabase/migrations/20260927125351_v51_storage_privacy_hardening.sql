-- V51 — espelho local da migration já aplicada ao projeto Supabase de produção.
-- Comprovantes financeiros são privados por usuário; avatars continuam públicos
-- para leitura, mas escrita/alteração/remoção exige pasta do próprio usuário.

drop policy if exists "Comprovantes são públicos" on storage.objects;
drop policy if exists "Usuários podem visualizar seus comprovantes" on storage.objects;
create policy "Usuários podem visualizar seus comprovantes"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Upload Avatares" on storage.objects;
drop policy if exists "Usuários gerenciam próprio avatar" on storage.objects;
create policy "Usuários gerenciam próprio avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Usuários atualizam próprio avatar" on storage.objects;
create policy "Usuários atualizam próprio avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Usuários deletam próprio avatar" on storage.objects;
create policy "Usuários deletam próprio avatar"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
