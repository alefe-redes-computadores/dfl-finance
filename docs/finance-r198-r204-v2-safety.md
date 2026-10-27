# R198–R204 R2 — contrato de integração segura

A R198 original foi bloqueada porque tentava substituir o registro simples anterior
(`const r=await db.rpc(rpc,params)`) que a R151 já havia substituído pela ponte V1.
Não devemos empilhar caminhos atômicos V1 e V2 para a mesma mensagem.

**Situação atual:** ponte V1 permanece opt-in, V2 permanece isolada do webhook.
Apenas os arquivos de teste e este documento foram criados.

**Para completar a V2**, precisa haver uma única transação que registra e consome
sessão, e uma etapa pós-commit que NÃO sobrescreva `consumed_at`, preserve
`TX_SETTLE`, comprovantes e recuperação de retries. É obrigatório comparar o
snapshot autorizado da mensagem com o payload financeiro.

**Não habilitar variáveis da V1 ou V2 em produção antes da implantação verificada.**
