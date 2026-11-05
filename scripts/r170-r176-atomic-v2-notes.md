# R170-R176 | Rota atomica v2 (nao ativada)

Esta mudanca corrige conceitualmente o CAS separado da rota v1: a v2 recebe a versao esperada, bloqueia a sessao e registra o lancamento **dentro da mesma RPC**. Um erro no registro cancela a transacao inteira.

**Limitacoes importantes:** A RPC de teste e um mock SQL, nao a RPC real com regras de saldo, conta e categoria. A v2 ainda NAO valida criptograficamente a correspondencia entre o provider_message_id e a chave idempotente; tal vinculacao deve ser finalizada antes de ativar. E necessario fechar os fluxos `TX_ACC`/`TX_CAT`, os comprovantes e a retomada apos timeout, avaliar os grants e testar concorrencia multiconexao com Postgres real.

O webhook de producao nao foi alterado por esta etapa. Nao aplicar a migration nem ativar a flag antes de E2E e revisao de seguranca. Nenhum schema de producao foi alterado.
