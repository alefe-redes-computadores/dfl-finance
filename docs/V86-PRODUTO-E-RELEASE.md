# V86 — produto diário e release coordenado

Estado: código e contratos locais. **Não significa release aprovado.** O instalador não instala dependências, não executa build, não abre IndexedDB do usuário, não publica e não altera banco.

## Entrega

- Transferência abre seu próprio editor. Valor, data, descrição e contas são corrigidos nas duas pernas dentro de uma transação Dexie com fila e saldos. Confirmação explícita; concorrência compara versão e conteúdo. Cancelamento remove o movimento inteiro e restitui o efeito às duas contas. Repetição não reaplica dinheiro. Uma direção legada ausente não é adivinhada pelo texto.
- A lista usa direção canônica e deixa de modificar objetos recebidos pelo hook. A busca agrupa as pernas sem apresentá-las como despesa/receita.
- Inbox e contador da Home compartilham política: pendência comum vencida/hoje, data inválida ou captura não revisada. Captura futura entra para revisão; após revisão explícita segue para Planejamento, mantendo `source`. `reviewed_at` é um campo novo declarado na migração V86; não representa pagamento. Cartões, faturas, dívidas, empréstimos, financiamentos e metas continuam nos seus fluxos proprietários. A revisão não move saldo; o botão de conciliação fica desabilitado para futuro/data inválida. Pendência legada que já declara efeito no saldo exige revisão assistida.
- Busca reconhece mês abreviado/ano, mês com typo, ano completo, datas civis e valores sem correspondência por substring numérica. Quando existe correspondência precisa, alternativas apenas fuzzy são suprimidas. As consultas repetidas de contas/categorias foram retiradas. Transferência pelo Command Center abre o formulário, sem executar operação.
- Editor genérico rejeita transação alterada desde a abertura antes de reverter saldo, inclusive mudança no mesmo milissegundo. Guard síncrono impede submissões concorrentes.
- Sincronização distingue fila vazia de confirmação remota nesta sessão, acompanha outbox, mostra causas qualitativas e preserva conflitos. Detalhes usam somente IndexedDB, quando o modal está aberto. Nenhum botão descarta fila, troca base ou inventa saldo.
- Backup v2 é um snapshot consistente de ambos os contextos, fila e outbox. Inclui referências de comprovantes, não seus arquivos. Valida arquivos v1/v2 para inspeção. **A restauração automática antiga foi bloqueada**: sobrescrever saldos e reenfileirar snapshots não produz uma trilha financeira válida. Exportar permanece disponível. Recuperação real precisa de procedimento assistido com comparação remota, não substituição cega.
- A antiga “autocorreção” que revertia pagamentos de séries futuras ao abrir páginas virou inspeção sem escrita. Data futura não prova que um pagamento confirmado foi errado.

## Gates

`node scripts/check-v86-product.mjs`

- TypeScript direto, sem build;
- 58 cenários Jest: 14 V84, 17 V85, 27 V86 (IndexedDB, concorrência, respostas perdidas, fórmulas, busca, Inbox, backup);
- 22 cenários Postgres isolado: 18 V84 e 4 V86, incluindo revisão sem saldo, correção/cancelamento de transferência e cancelamento anterior ao primeiro envio;
- 8 cenários dos handlers Edge com dependências simuladas;
- 13 contratos mobile existentes; ESLint e `git diff --check`.

Os 88 cenários de comportamento não substituem o teste de navegador com sessão, Supabase real, webhook real ou APK. A V86 não mudou assinatura, Gradle, Capacitor, status bar ou edge-to-edge. Não houve backfill de dados nem atualização remota.

## Fechamento das três cirurgias

1. **Local:** aplicar V86 e guardar o backup. Gerar também backup v2 dos dados locais antes da ativação remota; backup de arquivos do instalador não contém dados Dexie. Revisar filas antigas sem base, grupos sem direção e conflitos, sem apagar ou reconstruir automaticamente.
2. **Backend e PWA coordenados:** verificar preflight V84 no projeto correto, backup e compatibilidade; aplicar a migração V84 e `20261009230001_v86_review_metadata.sql`; verificar permissões/RLS e o RPC com casos controlados. Verificar credencial enviada pelo provedor WhatsApp e autenticação de scheduled-push antes de publicar handlers. Migração V84 inicialmente mantém enforcement desligado. Publicar cliente e validar confirmação atômica com enforcement desligado; somente depois ativar restrição a clientes antigos. Não repetir backlog do bot em massa. Publicação/ativação ainda requer autorização explícita.
3. **Aceitação:** PWA com recarga, offline/reconexão, segunda sessão, resposta perdida, fila antiga, dois contextos e comprovantes. Só depois workflow Android com assinatura existente, teste de atualização sobre APK anterior, cold start OAuth, offline, teclado/safe-area e notificações. PWA aprovada não certifica APK.

### Casos obrigatórios da aceitação

- + inferior em Transações abre formulário completo; outras telas preservam Ação rápida; nenhum + Nova duplicado.
- Transferir, corrigir valor/destino entre contextos, cancelar e reconectar: contas e duas pernas convergem; receita/despesa não sobem. Grupo legado sem direção mostra aviso e preserva dados.
- Compra de cartão fica na fatura; não pode ser paga novamente na Inbox. Captura futura revisada sai da Inbox sem debitar saldo.
- `outubr`, `outubro 2026`, `NOV/26`, `novembro de 2026`, `2026 completo`, valores, conta/categoria e InfinitePay.
- Home/Análise/Projeção concordam sobre o horizonte explicado, sem contar compra e liquidação duas vezes.
- Imagem WhatsApp sem contexto financeiro não sobe ao Storage nem aparece como comprovante; credencial inválida falha antes do banco.
- Lote conflitante e resposta perdida não desaparecem; backup guarda fila/outbox; nenhuma restauração automática sobrescreve saldo.

## Riscos residuais explícitos

A V86 não resolve uma fila histórica sem base apenas por acrescentar código. Também não reconstrói transferências legadas pela descrição nem importa backups automaticamente. Esses casos exigem revisão assistida com os dados reais. Backend real e credenciais do emissor continuam não validados após as cirurgias. Não declare “sistema principal pronto” enquanto esses itens e a aceitação PWA/APK permanecerem pendentes.

Fora deste release: integração DFL por eventos, fechamento mensal, resumos, aprendizado de regras, assinatura com vínculo explícito no ledger e restauração assistida completa. Não acrescentar telas ou automações para compensar inconsistências de saldo.
