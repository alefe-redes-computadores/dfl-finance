# R131–R132: contrato para autorizacao transacional

## Evidencia do banco (somente metadados; 26/10/2026)

- `public.bot_sessions`: `phone` PK, `step`, `temp_data` JSONB.
- `public.whatsapp_messages`: `provider_message_id` indice unico parcial.
- `bot_record_transaction`: idempotencia por chave; nao substitui controle de autorizacao.
- `bot_settle_transaction`: bloqueia linha financeira com `FOR UPDATE`.
- `bot_record_transfer`: duas pernas e chave idempotente.

## Fronteira de seguranca

Esta cirurgia NAO implanta CAS. O helper JS apenas define o comportamento esperado.
Concorrencia real exige armazenamento de proposal_id, revision, expiração e estado,
e UMA transacao SQL que valide e consuma autorizacao junto a chamada financeira.
Nao fazer claim antecipado fora da transacao: erro financeiro poderia consumir proposta
sem lancamento. Tambem nao confiar em 'sim' ou numero de revisao sem vinculo a
mensagem/proposta/sessao.

## Proxima migracao

1. Modelar ownership do telefone e usuario, politicas RLS e privilegios service_role.
2. CAS atomico sob bloqueio para mesmo telefone/proposta.
3. Consumo e gravacao financeira no mesmo contexto transacional ou desenho de retry seguro.
4. Simular duas requisicoes concorrentes reais no Postgres de teste, sem dados pessoais.
5. Only then integrar webhook e ativar por flag controlada.
