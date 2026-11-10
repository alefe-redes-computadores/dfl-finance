# Histórico de versões — DFL Finance

Este histórico descreve **funcionalidades do código**, não garante que a pessoa usuária já tenha o APK correspondente. O número de build Android é o `run_number` da Action de publicação, não o valor histórico `0.1.0` de `package.json`.

## R464 — Distribuição nativa e atualização consentida (candidata local)

- GitHub Actions só publica APK direto no GitHub Releases após sucesso dos gates e da compilação assinada; o artefato histórico de Actions permanece disponível.
- Android recebe download no próprio aplicativo, progresso, conferência SHA-256, packageId, versionCode e identidade de assinatura, com FileProvider privado.
- Instalação continua exigindo confirmação explícita do sistema; fluxo de autorização de origem é indicado ao usuário quando necessário.
- Browser/PWA recebe links comuns sem permissão Android. Há fallback manual para falha de rede, incompatibilidade ou falta do primeiro APK com a ponte R464.
- Sem mudança no bot WhatsApp, Supabase, dados financeiros ou motor de sincronização. Ação CI e homologação no dispositivo ainda necessárias.

## R463 — Acabamento premium mobile-first (candidata local)

- Transações: cabeçalho integral deixa de usar sticky; rola junto com extrato, eliminando sobreposição em listas longas.
- Home: saldo mais compacto, legibilidade do título aprimorada e ornamentação removida; lógica de privacidade e estado offline preservados.
- Nova receita/despesa: topo, valor e espaçamentos compactados sem reduzir alvos de toque, remover ações ou alterar validação.
- Mais: grupos mais leves, sem borda dupla e com espaçamento menor; navegação e permissões preservadas.
- Análises: reduz distâncias dos KPIs; evita gráfico comparativo vazio com eixos artificiais; corrige margem e rótulos da projeção. Cálculos e fórmulas financeiros inalterados.
- Gate R463 e testes; requer inspeção visual no APK/PWA antes de certificação final. Sem mudanças no banco, webhook ou sync.

## R462 — Integridade comercial e compatibilidade de comprovantes (publicada no código; homologação Android pendente)

- Alocação comercial passou para o RPC idempotente já implantado; intenção armazenada localmente antes da chamada, com a mesma chave e payload reutilizados após falhas e reaberturas.
- Vendas, repasses e alocações usam paginação estável por UUID, filtros de proprietário/loja/plataforma no servidor, contagem verificada antes/depois e bloqueio de totais em leitura incompleta. Isso não é snapshot transacional simultâneo nem substitui reconciliação em banco quando houver concorrência.
- Histórico comercial renderizado progressivamente para reduzir custo de UI em listas extensas.
- Nome físico de novos comprovantes segue o MIME aceito; arquivos legados `.jfif` e `.jpe` continuam compatíveis com OCR privado de usuário autorizado.
- Testes e documentação de fechamento. **Sem nova migração, sem alteração de saldos ou bot WhatsApp.**

## R461 — Fechamento de segurança e transparência — APK #1048

- OCR de comprovantes: aceita apenas URL assinada de arquivo privado na pasta do usuário autenticado, na origem Supabase conhecida; mantém rejeição de URL externa, arquivo alheio e redirecionamento.
- Android: preflight CORS limitado a `https://localhost`, com POST autenticado para OCR e extração de faturas.
- Assistente: mensagens internas de erro do provedor não são enviadas ao usuário; logs técnicos permanecem apenas no servidor.
- Privacidade web: robôs de busca bloqueados para a aplicação financeira, sem sitemap público; cabeçalhos defensivos no host web sem mudar a exportação Capacitor.
- Central de Atualizações: histórico legível das novidades, mantendo comparação real de build/artefato.
- README e inventário de segurança atualizados; nenhuma exclusão automática de scripts legados ou alteração do ledger.

## R460 — Busca Turbo — APK #1047

- Busca 360 otimizada, com correspondências mais eficientes e autocomplete normalizado.
- Auditoria de fechamento e 13 fontes da pesquisa preservadas.

## R459 — Resumo Android opcional — APK #1046

- Avisos proativos somente com opt-in; proteção da privacidade e diagnósticos de builds Android.

## R458 — Inteligência explicável — APK #1045

- Central de Observações do Finance com justificativa, evidências, histórico e frequência.

## R457 — Central de Notificações 360 — APK #1044

- Personalização de categorias, horários e lembretes nativos para compromissos financeiros.

## R456 — Atualizações de APK — APK #1043

- Verificação da versão instalada, Action aprovada, disponibilidade e prazo de expiração.

## Limitações de homologação

Uma Action verde não comprova notificações reais com o Android encerrado, recebimento de WhatsApp pela Evolution, sincronização offline/online no dispositivo ou isolamento com contas diferentes no ambiente real. Esses cenários requerem teste controlado.
