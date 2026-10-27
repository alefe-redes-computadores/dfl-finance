# R227–R234 · Bloqueio funcional de ativação indevida

Esta cirurgia **não conclui a V2**. Ela impede que flags de ambiente ativem
acidentalmente a ponte V1 (CAS separado do registro) ou indiquem V2 habilitada
antes de sua integração segura. No ambiente atual, com flags ausentes, o
comportamento legado permanece intacto. Mensagens de erro explicitam a falha
em vez de cair silenciosamente num segundo escritor financeiro.

## Impedimentos para release da V2

1. Persistir snapshot imutável e vincular à identidade da mensagem/usuário.
2. A RPC V2 precisa usar essa identidade, conferir todos os campos e registrar
   lançamento/consumo sob um único bloqueio e transação real.
3. Testar contra tabelas, constraints, privilégios e motor financeiro reais,
   sem usar dados da produção.
4. Garantir retries pós-commit e finalização de `TX_SETTLE` sem perder o consumo.
5. Revisar migração consolidada R219 antes de implantação.
6. Somente após os testes, integrar V2 ao webhook, publicar com flags desligadas,
   e solicitar autorização explícita para migração e ativação.

Nenhuma flag foi ativada, nenhuma migração foi aplicada. Sem commit ou push.
