# DFL Finance R351 — Ledger proof e campos congelados

**Status: candidato local, NUNCA implantar sem aprovacao expressa.**

O `r350-v2-release-bundle.sql` permanece intacto. R351 deriva dele um unico
`r351-v2-release-bundle.sql` (uma transacao BEGIN/COMMIT) alterando apenas a
ultima definicao do gatilho de sessao. R219, RPC financeira e R347 preservadas.

- Rejeita transicao para `TX_SETTLE` com `transaction_id` inexistente.
- Rejeita transicao com transacao de outro usuario, conta, categoria, chave,
  valor, tipo, descricao, data, contexto, origem ou estado financeiro.
- Rejeita alteracoes nos dados financeiros canonicos apos congelamento.
- Exige congruencia do snapshot imutavel com o root na atualizacao.
- Aceita commit valido e duplicate identico somente sob prova real.
- Nao altera saldo, contas, transacoes, credenciais nem execucao do webhook.

## Antes da implantacao

O teste PGlite usa a RPC financeira copiada do PostgreSQL real, mas **nao**
substitui homologacao com duas conexoes PostgreSQL e execucao integrada no
Supabase real. Somente depois aplicar a R351 por migracao autorizada; confirmar
permissoes/RLS, logs e publicar webhook mantendo ambas as flags V2 desligadas.
