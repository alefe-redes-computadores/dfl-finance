# DFL Finance | R191-R197 — Plano de implantação bloqueada

Estado: **LOCAL; NÃO DEPLOYAR AINDA**.

## Fonte de verdade

- Produção: Supabase DFL Finance, versão atual de `bot_sessions` sem `revision` no momento da inspeção anterior.
- Migrações locais: R133 (CAS/coluna), R142 (wrapper experimental), R146 (geração 1), R157 (recuperação), R170 (V2).
- Candidato funcional: **R170 V2 endurecida pela R177**. A R133 é pré-requisito de schema.
- R142, R146 e R157 são intermediárias. Não aplicar automaticamente nem apagá-las sem reconciliação.

## Bloqueios antes de autorizar SQL de produção

1. Inspecionar o estado de migrações do Supabase imediatamente antes do deploy e conferir assinaturas reais.
2. Reconciliar e testar as novas migrações em **PostgreSQL isolado com schema financeiro real** e snapshot completo do webhook (incluindo categoria nula).
3. Garantir que a vinculação da chave de idempotência ao `provider_message_id` seja verificável no banco, e que duas mensagens concorrentes não possam consumir a mesma proposta.
4. Integrar `atomicBotSingleV2` ao webhook somente para `income/expense` simples, sem fallback para `recordTx` antigo quando houver falha.
5. Garantir comprovantes, mensagem de retorno, efetivação posterior e recuperação de falhas pós-commit.
6. Revalidar RLS, permissões de `execute`, `security definer`, `search_path`, propriedade do usuário e concorrência real.
7. Confirmar plano de implantação e rollback com o operador antes de qualquer migração de produção.
8. Após aprovação e publicação do SQL, ativar a rota V2 separadamente, monitorando erros e sem reprocessar mensagens antigas.

## Regra de release

**Não habilitar atomicidade V2 no webhook e não implantar migrações experimentais em série.**
Este pacote é um bloqueio de release verificável e um plano de implantação; NÃO é implementação completa de E2E.
