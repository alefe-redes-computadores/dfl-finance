# R315–R322 — Ensaio V2 com a RPC financeira real

O PGlite não inclui `auth.role()` nativamente. O ensaio cria exclusivamente no banco de teste um stub que lê `request.jwt.claim.role`, definido como `service_role`, sem editar a migração SQL ou a RPC real. Esse stub não substitui testes de segurança sob diferentes papéis no Supabase.

A função `public.bot_record_transaction` reproduz a definição consultada por leitura no Supabase **DFL - Finance** em 27/10/2026. A migração V2 é carregada do arquivo local consolidado R219.

**Escopo:** banco PGlite isolado, tabelas de teste, nenhuma conexão remota. Testa criação `pending`, saldo intocado, revisão, replay, autorização, erro de categoria/contexto e rollback transacional.

**Ainda bloqueado para produção:** schema completo do app, duas conexões concorrentes, webhook com snapshot persistido, fluxo de comprovantes, recovery pós-commit, idempotência de rede e migração definitivamente aprovada. A implementação deve ser revalidada se o corpo da RPC remota mudar.

Nenhum SQL foi aplicado no Supabase e a flag V2 segue desligada.
