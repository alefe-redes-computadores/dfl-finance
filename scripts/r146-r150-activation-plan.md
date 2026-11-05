# R146–R150 — implantação controlada

## Entregue

- RPC SQL única com lock de linha, revisão, proposta, identidade do usuário e snapshot de todos os campos financeiros.
- Execução da RPC financeira existente na mesma transação e rollback em erro.
- Verificação de permissão `service_role`, idempotência, etapa e prazo.
- Contratos locais executáveis e gates financeiros.

## Ainda bloqueado (não chamar em produção)

1. O webhook atual **não** grava o snapshot normalizado completo (`proposal_id`, `user_id`, `account_id`, `category_id`, `idempotency_key`) nas etapas necessárias.
2. O webhook ainda não invoca essa RPC e sua lógica de comprovantes/`TX_SETTLE` precisa de reconciliação pós-commit.
3. `bot_sessions.revision` da R133 não foi implantada no Supabase.
4. Faltam testes reais da nova RPC em PostgreSQL com esquema efetivo, concorrência e recuperação.
5. Fluxos de recorrência, transferências e liquidação são explicitamente **fora de escopo**.

**Não implantar este SQL isoladamente. Não renomear a RPC antiga.**
