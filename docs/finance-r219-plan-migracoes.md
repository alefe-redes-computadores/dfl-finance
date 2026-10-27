# DFL Finance — R212–R219 | Plano de consolidação SQL

## Estado
A candidata `20261026220000_r219_bot_atomic_v2_consolidated.sql` agrupa, literalmente e nesta ordem,
R133 (controle de versão) e a RPC V2 local (R170–R183).
Não implantar a candidata junto com suas gerações intermediárias.

## Impedimentos à ativação
- Confirmação V2 ainda não comprovada com o `bot_record_transaction` real num banco isolado.
- Snapshot da proposta ainda precisa de gravação de sessão compatível com o CAS.
- Finalização após commit não deve eliminar `consumed_at` e `transaction_id`.
- Retries, comprovantes, permissões e duas conexões concorrentes precisam ser ensaiados.
- Conferir situação da tabela real, versões implantadas, SQL exato e backups.

## Operação
Esta etapa cria somente uma migração candidata e um teste de instalação em PGlite.
**Não implantar**, não ativar flags e não usar `supabase db push` automaticamente.
A próxima cirurgia deve integrar o webhook e passar no E2E, antes de solicitar aprovação
explícita para implantação no banco financeiro de produção.
