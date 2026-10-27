# DFL Finance — R347–R349 | Fechamento de concorrência e idempotência

Status: **CANDIDATA SQL LOCAL, SEM IMPLANTAÇÃO NO SUPABASE**.

A R219 consolidada segue **intocada** para que o gate de integridade R212 permaneça válido.
O complemento SQL em `docs/sql-candidates/` substitui somente a função V2 e adiciona
um gatilho de proteção às sessões que já tenham `atomic_snapshot`.

- **Concorrência:** `save()`/upsert sem revisão não pode sobrescrever uma sessão
  congelada; o commit V2 é a única transição aceita para `TX_SETTLE`.
- **Idempotência:** a V2 lê e bloqueia (`FOR UPDATE`) a transação real retornada
  por `bot_record_transaction` e valida todos os campos, inclusive ao receber
  `duplicate=true`. Uma divergência causa rollback do commit e da autorização.
- **Legado:** sessões sem `atomic_snapshot` permanecem inalteradas. Sessões
  consumidas podem ser excluídas pelo fluxo legítimo de efetivação/pendência.
- **Limite:** gatilho pode bloquear cancelamento de uma proposta CONGELADA que
  ainda não consumiu a autorização; recuperação/cancelamento administrativo precisa
  ser desenhado antes do rollout. O ensaio PGlite não substitui concorrência real
  em **duas conexões** nem a revisão da topologia Supabase.
- **Implantação:** primeiro R219 consolidada (após revisão), depois a SQL
  complementar em uma migração criada pela CLI ou pela ferramenta de migrações.
  Nunca instalar os wrappers intermediários R142/R146/R157/R170 em paralelo.
- **Ativação:** manter `DFL_BOT_ATOMIC_V2_ENABLED` e
  `DFL_BOT_ATOMIC_V2_RELEASE_GATE` ausentes até homologação do servidor e webhook.

Nenhum saldo, registro financeiro ou tabela remota foi alterado nesta etapa.
