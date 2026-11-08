# DFL Finance — R460 | Busca Turbo e Auditoria de Fechamento

**Base:** R459, commit `bb417da07dd59e9587fa7ca0b34ffa39f7447a0f`. **Natureza:** patch de performance e verificação de integridade.

## Resultado da auditoria estática

- **Busca universal (13 tabelas):** preservadas transações, contas, cartões, dívidas, empréstimos, financiamentos, assinaturas, metas, categorias, contatos, tags, orçamentos e faturas.
- **Identidade e contexto:** todas as leituras continuam filtradas por `user_id` e contexto PF/PJ; faturas usam filtro de contexto após índice `user_id`.
- **Sem cache financeiro persistente:** o sistema consulta Dexie no momento da pesquisa e não guarda resultados entre contas.
- **Otimizador R460:** indexa as palavras de cada candidato uma só vez e só cria representações monetárias quando a consulta contém algarismos. Meses, ranking, correspondência aproximada, contatos e os filtros de relevância existentes foram preservados.
- **Autocompletar de transações:** normalização de acentos e agrupamento de descrições em função pura, com leitura Dexie isolada por usuário e contexto.
- **UX:** indicador de duração da consulta local, sem registrar palavras consultadas, valores ou nomes em analytics.
- **Notificações/Inteligência:** nenhuma mudança no agendador Android, permissões ou preferências da R457–R459.
- **Integração WhatsApp:** nenhum arquivo do webhook ou migração é modificado.
- **Android/atualizações:** R456–R459 permanecem verificadas pelos contratos antigos e novos gates da Action.

## Gates obrigatórios

Verificador R460, Jest R460, checkers R435/R436/R428/R456–R459, TypeScript, ESLint, mobile:check, Jest global, `git diff --check` e escopo seletivo. Nenhum gate deve ser desligado para publicar.

## Homologação REAL pendente (não substituída por teste estático)

1. APK Android após GitHub Action READY: abrir Busca, trocar Empresa/Pessoal e conferir ausência de vazamento.
2. Pesquisar `mercearia Silvana`, `fatura Nubank`, `meta viagem`, `novembro de 2026`, `49,00`, `novo cartão`, `comprovantes`, `financiamento` e uma palavra digitada com erro leve. Comparar com dados reais e resultados da versão anterior.
3. Abrir e fechar modal de filtros, testar voz, revisar comandos antes de lançar, navegar pelos resultados e verificar a indicação de tempo.
4. Configurar lembretes, negar e autorizar notificação, ativar/desativar resumo inteligente, testar app em primeiro e segundo plano e completamente fechado.
5. Conferir estados de atualização: Action sucesso, falha e APK expirado. Nunca oferecer instalação silenciosa.
6. Registrar transação de teste via bot (ex.: `gastei R$ 32 em mercearia Silvana`) e conferir conciliação; **não executar lançamento real somente para homologar**.
7. Verificar PWA em atualização, sincronização offline/online, safe-area e componentes na parte inferior da tela.

### Limites da certificação

Os gates automatizados não comprovam permissão em aparelhos reais, entrega garantida pelo Android em modo Doze, performance absoluta de hardware ou integridade ponta a ponta de WhatsApp e Supabase em produção. Caso um teste prático falhe, abrir ocorrência específica, sem outra macrorefatoração indiscriminada.
