# R465 — Fechamento de navegação, MEI assistido e lembretes

Base: commit GitHub `bcc37cd43995b82444333689e90843888dc2de31` (R464). Primeiro APK com atualizador integrado: #1052.

## O que entra

- **Mais:** menus agrupados em contas e empresas, planejamento, inteligência e sistema; nova entrada para obrigações MEI; ícones Lucide; sem remover rotas ou funcionalidades; rótulo antigo de versão removido.
- **Gestão comercial:** atalho para enquadramento por organização já cadastrada; escolha por botões (sem `<select>` nativo), CNPJ permanece sob validação atual. Tipos: desconhecido, MEI, Simples, Presumido, Real e Outro.
- **MEI:** competência inicial declarada, lista de competências recentes, previsão do DAS no mês seguinte com deslocamento de fim de semana, marcação manual/reversível de pagamento, acesso ao PGMEI e DASN-SIMEI oficiais, registro manual de entrega anual.
- **Lembretes:** central dividida em assuntos financeiros e fiscais. Fiscal OFF por padrão, exige push geral autorizado + regra fiscal ativada + perfil MEI com data válida. Reutiliza motor Android com privacidade e horizonte de 60 dias; não cria outro serviço de mensagens.
- **Notificações:** página de histórico sem cabeçalho que obscurece a lista, melhor explicação das diferenças entre avisos recebidos e lembretes programados.
- **Versão:** próximo build Android aprovado, para testar R464 -> R465 pelo updater nativo. Não muda downloader, assinatura nem release channel.

## Limites fiscais — essenciais

- Nenhuma consulta automática ao Fisco: CNPJ não determina sozinho condição de MEI, nem prova situação fiscal.
- "Data passou · pagamento não confirmado aqui" é um lembrete **local**, não dívida confirmada na Receita Federal.
- Sem salário mínimo, cálculo de tributo, boleto próprio, web scraping de gov.br, solicitação de senha gov.br, pagamento automático, movimentação de saldo ou geração de transação.
- O vencimento-base do DAS é dia 20 do mês seguinte, prorrogado em dias sem expediente bancário. O cálculo local ajusta apenas sábados e domingos; **não conhece feriados bancários**. A data do DAS oficial prevalece.
- O usuário confirma cada pagamento/declaração manualmente. O registro fica nas preferências da própria conta, com cache offline e sincronização existente; não é prova de quitação.
- Links oficiais: https://www.gov.br/pt-br/servicos/emitir-das-para-pagamento-de-tributos-do-mei e https://www.gov.br/pt-br/servicos/declarar-receita-bruta-anual-para-o-mei.

## Homologação R464 → R465

1. Instalar e abrir o APK #1052 (já realizado pelo usuário); verificar Central de Atualizações mostrando versão instalada.
2. Aplicar e publicar R465 após gates locais. A Action deverá mostrar R465 green e job **Publish verified APK** concluído.
3. No **APK #1052 ainda instalado**, ir a Mais → Atualizações → Verificar: deve detectar #1053 (ou o `run_number` real superior). Acionar **Baixar e atualizar no aplicativo**.
4. Observar 0→100%, SHA, assinatura, pedido de permissão de instalação (se necessário), abertura do instalador nativo e instalação confirmada pelo Android. Não desinstalar o app.
5. Reabrir o Finance e validar manutenção de sessão/dados, versão nova, páginas Mais, MEI, Central de lembretes e notificações; testar fallback e não tentar baixar build expirado/falho.
6. Se falhar, usar manual do GitHub Releases e registrar texto exato do alerta; uma Action verde não prova instalador Android.

## Gates e proteção

- Criar backup seletivo dos arquivos rastreados e garantir ausência de mudanças no stage.
- Testes puramente determinísticos para políticas de competência, confirmação manual, feriados (aviso), isolamento de dono e opt-in.
- TypeScript, ESLint, checker R465, gates anteriores R464/R457/R455, V163 do workflow e Jest global.
- Sem alterações de Supabase, Evolution, WhatsApp, bot, lançamentos, saldos, sincronização, keystore, package id ou native Android Java.
