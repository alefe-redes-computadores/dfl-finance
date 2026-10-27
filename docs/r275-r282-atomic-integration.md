# R275–R282 — Adaptador de integração V2

Implementado o módulo `atomicV2Integration.ts` com três operações explícitas:
`prepare` chama CAS da proposta, `commit` invoca a RPC V2 preparada,
`recover` só retorna sucesso após verificação do ledger.

**Não é prova E2E e NÃO está conectado ao webhook.** Ativação permanece
bloqueada. Antes da publicação: validar esquema real com a RPC financeira real
em banco isolado, concorrência em conexões independentes, rollback pós-falha,
replays após commit, recibos, finalização sem sobrescrever `consumed_at`, e
migração consolidada. Não rodar a flag V2 em produção.
