# R163–R169 | Integração PostgreSQL isolada

- A função `dfl_bot_record_single_atomic_r146` da migração R157 é executada **sem reescrita** em PGlite.
- Apenas `bot_record_transaction` é substituída por RPC financeira simulada **com a mesma assinatura**. O objetivo é demonstrar a lógica de sessão e rollback, não reproduzir regras reais de contas ou saldos.
- O banco de produção não é acessado por este script.
- Bloqueios: a integração da R151 ainda fica desligada por padrão; migrações R133, R146, R157 precisam ser revisadas e implantadas separadamente, com migrações versionadas e um plano de rollback.
- Não declarar equivalência com teste E2E de produção, não ativar flag, não migrar automaticamente.
- Riscos pendentes: fluxo pós-commit de recibos, regra real de permissão do usuário, concorrência entre conexões, alterações paralelas na sessão e compatibilidade de `auth.role()`/contratos reais.
