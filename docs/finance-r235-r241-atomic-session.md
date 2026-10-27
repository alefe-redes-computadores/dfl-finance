# R235–R241 — Contrato funcional de sessão V2

Esta cirurgia adiciona um módulo TypeScript reutilizável para congelar a proposta,
validar revisão, identificar dados adulterados e validar o retorno da RPC atômica.
A V2 permanece bloqueada no webhook por `R227_R234_UNSAFE_MODE_GUARD`.

## Ainda obrigatório antes de ativar

- Integrar persistência do snapshot no banco com controle CAS e sem sobrescrever
  revisão concorrente.
- Garantir que a função SQL valide cada campo contra a sessão persistida.
- Validar ledger real, identidade da mensagem, comprovantes e retries em PostgreSQL
  isolado e duas conexões.
- Alterar a finalização do webhook para preservar o `consumed_at`, `revision`
  e `transaction_id` gravados pelo banco; sem segunda gravação financeira.
- Revisar e aprovar migração consolidada antes da implantação remota.

O módulo desta cirurgia não grava nem autoriza transações por si só.
Nenhum deploy, commit, push ou migração remota.
