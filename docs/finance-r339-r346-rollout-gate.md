# DFL Finance — R339–R346 | Fechamento do timeout pós-commit

Estado: **somente código local, sem implantação nem migração remota**.

## Correção funcional

A ponte R330 passa a tentar recuperação exclusivamente de leitura em caso de falhas
*ambíguas de transporte*, como timeout/conexão reiniciada, porque o banco pode ter
registrado a transação antes de a Edge Function receber a resposta.

- Se a verificação do ledger confirmar a mesma proposta: recupera o ID e o pós-registro
  valida novamente a sessão consumida **e** a transação.
- Se a recuperação falhar: mantém a falha original; nunca cai na RPC legada, não
  registra outra transação e não declara sucesso.
- Erros financeiros não ambíguos continuam rejeitados sem tentativa de recuperação.
- Com ambas as flags V2 ausentes, o legado permanece inalterado.

## Bloqueios remanescentes antes de produção

1. R219 é candidata SQL local, não aplicada remotamente. Não aplicar R133, R142,
   R146, R157 e R170 em paralelo com R219; preparar **uma** migração aprovada.
2. Em `bot_sessions`, `save()` legado usa upsert sem CAS e pode interferir
   durante o congelamento do snapshot. Necessita solução para concorrência entre
   webhooks com duas conexões/PostgreSQL completo antes de ativar.
3. A RPC precisa conferir na própria transação o conteúdo de uma linha devolvida
   como `duplicate=true` pela `bot_record_transaction`, antes de consumir a sessão.
4. Homologar o webhook em ambiente de teste com respostas perdidas, comprovantes,
   efetivação, categoria ambígua e contas Empresa/Pessoal.
5. Após aprovação explícita, aplicar SQL remoto, verificar permissões e publicar
   o webhook com **as duas flags V2 ausentes**; ativação exige plano separado.

Esta etapa não aprova o rollout de produção nem modifica a lógica de saldo.
