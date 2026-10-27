# R259–R266 — Recuperação de operação consumida com prova de ledger

**Funcionalidade local:** `verifyAtomicV2Recovery(input)` faz leitura de `bot_sessions` e de `transactions`, filtra ID, proprietário e chave de idempotência e compara os demais dados financeiros. Recusa recuperação com qualquer divergência e não executa escrita financeira.

**Não é ativação do bot.** A função nova permanece desconectada do webhook, que continua bloqueando a V2. Ela não transforma um `TX_SETTLE` em autorização para liquidar saldo e não usa o campo `consumed_at` como única prova de conclusão.

**Pendências antes de implantação:** integrar ao webhook com provas E2E, verificar comportamento para recorrências, integrar comprovantes sem sobrescrever `temp_data` consumida, validar a RPC com motor real e migração no PostgreSQL completo e revisar política de replay para mensagens com duplicidade de provedor.
