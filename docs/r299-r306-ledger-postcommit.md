# R299–R306 | Prova do ledger no pós-commit

O webhook adiciona **uma consulta de leitura** ao registro real de `transactions`
quando o resultado declara `atomic: true`, depois de comprovar `consumed_at`
na sessão. Os campos essenciais da transação precisam corresponder à proposta.

Esta alteração NÃO ativa a V2 e não substitui a verificação atômica no banco.
Se a sessão foi consumida e a operação financeira foi confirmada, mas a
consulta falhar temporariamente, o webhook não confirma sucesso. Uma repetição
precisa seguir a recuperação idempotente, nunca fazer novo lançamento.

**Bloqueios remanescentes:** migração consolidada não aplicada, fluxo completo
de snapshot + confirmação ainda não conectado e E2E do ledger real com concorrência
não comprovado. Não publicar como V2 pronta.
