# DFL Finance — R350 | Decisão de implantação da V2

**Estado: candidato técnico local. Não publicado. Nenhum dado de produção modificado.**

## Correções completas do ciclo R119–R350

- R219 preservada sem alterações; contém CAS de sessão e autorização + registro numa RPC PostgreSQL.
- R347 protege sessão congelada contra sobrescrita por `save` legado e verifica payload real de chave de idempotência repetida.
- R350 permite excluir/cancelar proposta congelada **apenas sem transação correspondente**, mantendo bloqueio para ledger já existente.
- `docs/sql-candidates/r350-v2-release-bundle.sql` reúne as três implementações em **uma transação SQL**.
- O webhook atual mantém as flags da V2 desligadas. Não criar variável de ativação nesta cirurgia.

## Bloqueios remanescentes para liberar produção

1. Confirmar compatibilidade do bundle com o esquema e as permissões do Supabase remoto (somente leitura primeiro).
2. Testar concorrência em duas conexões PostgreSQL. PGlite é um único backend, não demonstra isso.
3. Verificar se `auth.role()` e o modelo de permissão usado na RPC serão suportados pelo ambiente de produção.
4. Auditar efeitos de bloqueio do trigger sobre rotas existentes de cancelar/refazer, limpeza de sessão e comprovantes.
5. Aplicar migração **somente com aprovação explícita**. Conferir objetos, `GRANT/REVOKE` e integridade após a aplicação.
6. Publicar webhook **com ambas as flags de ativação ausentes**, conferir logs e só depois executar rollout controlado.

**Não implantar** as migrações intermediárias R133, R142, R146, R157 e R170 junto ao bundle; o bundle consolida essas gerações.

## Limitações do teste

O PostgreSQL de teste executa a definição financeira auditada anteriormente em um esquema simulado. Não equivale a usar todas as tabelas, triggers e RLS da produção. O teste também não comprova simultaneidade real entre duas conexões.
