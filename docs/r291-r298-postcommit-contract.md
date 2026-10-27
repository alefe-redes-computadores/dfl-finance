# R291–R298 R3 — Integridade de pós-commit

O webhook já possui um ramo atômico separado do `else await save(...TX_SETTLE...)` legado.
A R3 **não substitui** esse ramo. Antes de vincular comprovante e responder,
quando `r.data.atomic===true`, exige leitura da sessão `TX_SETTLE` com
`consumed_at`, `transaction_id` e `idempotency_key` compatíveis.

**Não libera V2**. A flag segue bloqueada por `DFL_ATOMIC_V2_NOT_RELEASED`.
A verificação adicional é apenas uma proteção local. Para ativação futura,
validar o contrato do retorno `atomic`, o snapshot completo e o ledger real,
inclusive casos de resposta perdida após commit.
