# R307–R314 — Ensaios da migração consolidada

Executa a função PostgreSQL da candidata R219, com sessões reais em PGlite e uma implementação substituta da RPC `bot_record_transaction`.

Valida commit/consumo numa mesma transação, replay sem dupla gravação, revisão obsoleta, snapshot incompleto/adulterado, rollback e permissões.

**Não equivale à aprovação para produção.** A RPC financeira é simulada; faltam E2E com o corpo real da função, duas conexões concorrentes, mensagens do WhatsApp, comprovantes, pós-commit e validação do saldo.

Nenhum comando SQL remoto, commit ou deploy é executado por este pacote.
