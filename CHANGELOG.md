# Histórico de versões — DFL Finance

Este histórico descreve **funcionalidades do código**, não garante que a pessoa usuária já tenha o APK correspondente. O número de build Android é o `run_number` da Action de publicação, não o valor histórico `0.1.0` de `package.json`.

## R461 — Fechamento de segurança e transparência (pendente de validação/publicação)

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
