# R283–R290 R2 — Handoff V2 testável, sem ativação

Novo módulo `atomicV2WebhookHandoff.ts` usa o adaptador R275 com
`prepare → commit` e `recover` exclusivamente via leitura do ledger.
Valida identidade, conta, categoria, valor, descrição, contexto, data e
idempotência antes de qualquer chamada. Falhas propagam sem fallback.

**A integração ainda NÃO está em produção e NÃO está conectada ao webhook.**
O novo módulo continua separado porque a V2 requer E2E com o
`bot_record_transaction` real e precisa garantir que `TX_SETTLE` não
sobrescreva `consumed_at`. Também faltam testes com conexões concorrentes.
A sequência `prepare → commit` contém duas chamadas: o commit financeiro
somente será atômico quando a RPC V2 e o esquema consolidado estiverem
validados. Não assumir que este handoff garante atomicidade de ponta a ponta.

Sem SQL remoto, push, commit, build Android ou ativação de flags.
