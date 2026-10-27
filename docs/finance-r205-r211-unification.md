# R205–R211 — Unificação preparatória V2

Esta cirurgia **não habilita** a V2. Adiciona congelamento puro do snapshot completo, comparação estrita dos seus 11 campos e proteção precoce do helper V2. O webhook de produção continua usando seu código existente.

## Bloqueios reais antes de ativar

1. O webhook deve persistir atomicamente o snapshot **antes** da RPC V2, sem destruir `revision` e sem reabrir propostas consumidas.
2. A derivação da chave do `provider_message_id` precisa ser autenticada também no PostgreSQL, não só conferida no cliente.
3. A finalização pós-registro não pode sobrescrever `consumed_at`, `transaction_id` ou `revision` gravados pela RPC.
4. Testes no PostgreSQL com RPC financeira real, concorrência entre conexões, rollback e falha pós-commit ainda são necessários.
5. As migrações intermediárias (R133, R142, R146, R157, V2) não devem ser aplicadas em lote sem revisão de dependências e consolidação.

Sem deploy, migração remota, commit, push ou build.
