# R139–R141 — Contrato de autorização atômica (pré-integração)

**Estado:** prova PostgreSQL local, não implantada. Não é uma RPC pronta para produção.

## Evidência existente

- `bot_sessions(phone, step, temp_data)` é a estrutura observada em produção antes da migração R133.
- `whatsapp_messages.provider_message_id` possui índice único parcial.
- `bot_record_transaction`, `bot_record_recurring_transactions`, `bot_record_transfer` e `bot_settle_transaction` já existem, com regras financeiras próprias.
- O webhook local possui revisões e confirmação explícita, porém chamadas HTTP separadas não fornecem atomicidade da sessão com o ledger.

## Contrato exigido para produção

1. A autorização e a RPC financeira devem executar na mesma transação PostgreSQL.
2. Bloquear a linha da sessão (`FOR UPDATE`), validar proprietário, etapa, identidade da mensagem, prazo e revisão.
3. Consumir exatamente a revisão autorizada, preservando a chave idempotente da operação.
4. Se uma função financeira falhar, a transação inteira deve ser revertida (inclusive consumo da autorização).
5. Controlar mensagens concorrentes com lock e identificador de operação.
6. Repetição do mesmo evento retorna resultado persistido; mesmo identificador com payload diferente é rejeitado.
7. `service_role` exclusivo para funções internas; verificar `PUBLIC`, `anon`, `authenticated`, RLS, `search_path` e assinaturas.
8. Não permitir execução baseada apenas em `sim` fora do contexto correto.
9. Compatibilizar R133 (migração ainda local) com o estado real do banco antes do deployment.
10. Validar integração usando base isolada e, depois, procedimento de publicação controlado.

## Escopo desta cirurgia

Executa provas reais de transação/rollback em tabelas sintéticas no PGlite. **Não instala nem modifica RPCs reais, não altera o webhook e não grava dados financeiros.**

A prova de modelo não resolve ainda todos os casos de concorrência remota, sessões duplicadas ou timeouts. Esses casos deverão ser cobertos na implementação concreta do wrapper após revisão das assinaturas completas.
