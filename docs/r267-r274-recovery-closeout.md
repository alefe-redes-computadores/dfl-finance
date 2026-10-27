# R267–R274 · Recuperação do ledger e fronteira de implantação

O módulo de recuperação agora rejeita estados financeiros contraditórios:
`pending` com `affects_balance=true`, e `done` sem `affects_balance=true`.
Não registra nenhuma transação nem modifica saldos durante a recuperação.

**Release continua bloqueado.** O webhook não chama o orquestrador V2. O SQL
consolidado R219 é candidato, não implantado. A implantação exige testar a RPC
V2 com a função financeira REAL e o esquema COMPLETO numa base isolada; verificar
retry após commit; persistir snapshot completo e reconciliar sessão/recibos; e
revisar permissões antes de qualquer flag em produção.
