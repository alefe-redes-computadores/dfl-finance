# R463 — Acabamento premium final (09/11/2026)

**Base obrigatória:** `12ad76cc812ef8edb5b88eeaed8ce836358950ca` (R462 publicada).

## Defeito de prioridade máxima

`src/app/(app)/transactions/page.tsx` mantinha o cabeçalho inteiro, incluindo
Comando, contexto, filtros, busca e abas, dentro de `sticky top-0 z-40`.
O contêiner principal `src/app/(app)/layout.tsx` já é o dono do scroll Android,
o que causava um topo excessivo sobrepondo as transações ao arrastar.
A R463 remove somente o sticky do cabeçalho de Transações e faz seu bloco
acompanhar a mesma rolagem da lista; **não altera o scroll global** nem a navegação inferior.

## Acabamento controlado

- Home: saldo mais compacto, título legível e sem marca d'água que competia com o olho.
- Nova transação: cabeçalho, valor e espaços reduzidos; CTA, validação e safe-area preservados.
- Mais: menus com alvos amplos, grupos colapsáveis e sem cartões aninhados/borda dupla.
- Análises: KPI mais compacto; gráfico sem dados não exibe eixos fictícios;
  projeção usa rótulos abreviados e largura adequada no eixo vertical.
- Changelog em código + notas internas; sem alterar fórmula de nenhum valor financeiro.

## Gates e limites

O instalador exige HEAD limpo R462, hashes íntegros, gates R463, R462/R461/R460,
TypeScript, lint, mobile:check, Jest global e diff --check; rollback seletivo.
Não altera banco, env, bot, webhook, RLS, módulos financeiros nem layouts globais.
**Não é comprovação visual renderizada do Android.** Após build, testar scroll com
teclado fechado e aberto, filtros pendentes, troca PF/PJ, lista curta e longa,
modo claro/escuro, botão flutuante e safe-area.

GO para publicar *somente se todos os gates passarem*; GO para adotar o APK
somente após homologação visual real.
