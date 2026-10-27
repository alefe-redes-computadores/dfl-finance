# R250–R258 — Orquestrador financeiro V2 (não ativado)

**Implementado localmente:** módulo que prepara snapshot via CAS, valida presença de
snapshot antes de chamar a RPC V2, e recusa conceder sucesso de recuperação sem
prova adicional no ledger. Não altera o webhook, sessões reais nem movimentos.

**Crítico:** a preparação por CAS NÃO é uma autorização financeira. Para publicar:
1. Verificar no banco real a assinatura final da RPC e o schema de `bot_sessions`.
2. Persistir o snapshot no fluxo correto (após resolver conta e categoria).
3. A RPC V2 deve revalidar todos os campos e consumir a sessão no MESMO COMMIT
   em que executa `bot_record_transaction`.
4. Não sobrescrever `consumed_at` ou `transaction_id` ao entrar em `TX_SETTLE`.
5. Verificar retry por `provider_message_id` e ledger; não presumir sucesso a partir
   de uma sessão isolada.
6. Executar E2E sobre PostgreSQL com RPC financeira real e teste de concorrência.

Status: **não implantável**. Nenhuma flag V2 foi ativada.
