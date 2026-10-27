# R330–R338 — Handoff real ligado ao webhook, desligado por padrão

**Estado:** código local, sem aplicação SQL nem publicação. Não ativar flags em produção ainda.

Apenas `recordTx` de receitas/despesas simples possui rota V2; V1 continua proibida.
A rota exige simultaneamente `DFL_BOT_ATOMIC_V2_ENABLED=true` e
`DFL_BOT_ATOMIC_V2_RELEASE_GATE=r330-db-approved`. Ausentes: legado atual.
Uma flag sozinha gera erro, nunca fallback. Recorrências no modo V2 são recusadas.

V2 usa o módulo `handoffAtomicV2`, que executa preparação CAS e a RPC transacional,
com verificação de sessão e ledger (R291/R299), sem usar `save(... TX_SETTLE ...)` legado.
O vínculo de comprovante após o registro permanece em transação e mensagens de auditoria.

**Ainda impedem a ativação real:**
1. Revisão final das migrações R219, da autorização `auth.role()` e permissões
   existentes no Supabase; migração local não é evidência de implantação.
2. Teste de concorrência *entre conexões reais* e recuperação quando webhook perde a
   resposta após o commit, com tabelas completas num banco de teste.
3. Garantir que gravações concorrentes em `bot_sessions` não sobrescrevam
   `atomic_snapshot` nem `revision` sem CAS. `save()` legado ainda usa upsert.
4. Confirmação de que operações em `TX_CONFIRM`, `TX_ACC`, `TX_CAT` e `TX_CAT_ALL`
   persistem `provider_message_id`, data e contexto corretos.
5. Homologação de comprovantes e mensagens de pós-registro no fluxo real.
6. Aplicar SQL somente com autorização e testar em ambiente remoto. O webhook
   deve ser publicado **com ambas as flags ausentes**.

Não habilitar nenhuma flag apenas porque os testes locais passaram.
