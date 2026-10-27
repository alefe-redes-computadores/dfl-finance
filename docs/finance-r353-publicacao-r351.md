# DFL Finance — R353 | Sincronia Git ↔ Supabase R351

**Banco:** Supabase DFL - Finance. **R351 instalada e auditada em produção em 27/10/2026**.

- Versão remota: `20261027181246_r351_bot_atomic_v2_release_bundle`.
- SQL candidato aprovado R351: SHA-256 `12da3d80e566859a54185460f9d61bb36b3e53f8a7aa28a73acf028bae43114d`.
- Migração em `supabase/migrations/`: a mesma R351 sem BEGIN/COMMIT externos, SHA-256 `2d49bb14508318dac6f2e89324d19277ba7f2a59803d1fb87f71674d300ee9c1`.
- Migrações de rascunho R133/R142/R146/R157/R170/R219 mantidas apenas como **fixtures históricas**; jamais aplicar em produção junto da R351.
- Gates históricos R119–R351 continuam ativos e apontam para os mesmos conteúdos SQL, agora em `docs/sql-candidates/historical-test-fixtures/`.
- Flag `DFL_BOT_ATOMIC_V2_ENABLED` e segundo gate `DFL_BOT_ATOMIC_V2_RELEASE_GATE`: **não configurados por este release**.
- Nenhum deploy da Edge Function neste release; GitHub pode executar workflows configurados no push.
- Esta etapa **não** concede autorização para testes financeiros reais, mudança de credenciais, segredos, nova SQL ou ativação V2.

**Depois do push:** verificar GitHub Actions. Em etapa separada, implantar Edge Function sob gate desligado e verificar logs antes de autorizar teste WhatsApp ponta a ponta.

> **R353 R3:** apenas uma linha vazia final foi eliminada do espelho Git para atender `git diff --check`. O SQL funcional e as instrucoes PostgreSQL implantadas permanecem identicos; o hash dos bytes do espelho local e diferente por essa normalizacao.
