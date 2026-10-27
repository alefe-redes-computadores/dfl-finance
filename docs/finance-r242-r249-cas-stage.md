# R242–R249 — Persistência por CAS do snapshot V2

A função `stageAtomicV2Snapshot` prepara os dados pela R235–R241, verifica
identidade/telefone/etapa/revisão e usa `dfl_bot_session_cas` para persistir
`atomic_snapshot` de maneira condicional, rejeitando concorrência e
snapshot já congelado. **Não escreve no ledger nem é chamada pelo webhook.**

## Bloqueios para a próxima etapa

- No SQL consolidado, `revision` precisa existir e CAS deve ter privilégios restritos.
- O webhook precisa distinguir preparação da proposta, escolha de conta/categoria
  e confirmação efetiva; CAS separado não autoriza dinheiro.
- A RPC de commit deve verificar todos os campos contra o snapshot persistido,
  bloquear a sessão e executar o ledger dentro da MESMA transação.
- Confirmar que a sessão consumida retém `consumed_at`, `transaction_id` e `revision`
  durante retry, comprovante e passagem para `TX_SETTLE`.
- Testar em PostgreSQL real isolado com concorrência entre duas conexões e
  os corpos reais das RPCs, antes de permitir a flag V2.

**SEM deploy, commit/push ou alteração do Supabase remoto.**
