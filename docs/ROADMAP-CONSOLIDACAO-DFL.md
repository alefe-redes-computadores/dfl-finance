# DFL Finance — três cirurgias de consolidação

Data: 09/10/2026. Base inspecionada: `c4962f46d5ff3f64c984ee2fd35a3168ddeb50f3`, main.

## Ordem e critério de sucesso

| Cirurgia | Resultado | Conteúdo | Aceite |
|---|---|---|---|
| **V84 — integridade financeira e segurança** | Nenhum saldo sem trilha confirmável; retry sem dinheiro duplicado | Operações locais atômicas; lote remoto com versão-base e confirmação persistida; soma de deltas comprovados diante de concorrência; transferências protegidas; contratos de crédito; autenticação de webhook/push; mídia vinculada; contexto único | Testes locais, Postgres isolado, instalação/ativação coordenada, PWA com dois clientes e bot real |
| **V85 — um cérebro financeiro** | O mesmo número e a mesma explicação em toda tela | Contrato único para caixa, resultado e compromissos; vencidos/faturas/recorrências; deduplicação por origem; conhecido × estimado; horizonte/contexto; transferências legadas; descoberta apenas com evidência; gestão pareada de transferências | Casos financeiros de referência, comparação com dados reais, linha do tempo e disponível conferidos |
| **V86 — produto diário e release** | Poucas telas, tarefas claras e experiência mobile coerente | Home enxuta; Inbox × Planejamento; busca precisa/Command Center; comprovantes; hierarquia de Mais/Análise; diagnóstico de sync e ações de recuperação; aceitação PWA → release gate → APK | Percursos reais no celular, offline/reabertura, teclado/safe-area, atualização de PWA e APK assinado |

Não abrir versões para cada detalhe. Não agrupar um ajuste cosmético com uma nova regra contábil sem contrato. V85 depende da integridade da V84; V86 depende de números confiáveis.

## Bloqueadores de release

1. Webhook que não inicia e endpoints de operação sem autenticação de entrada.
2. Atualização independente de saldo e ledger; perda de intenção offline diante de saldo remoto novo.
3. Contrato remoto incompatível com UUIDs e operações de crédito já oferecidas no app.
4. Edição/exclusão genérica de uma perna de transferência.
5. Disponível/projeções sem demonstração de ausência de dupla contagem e sem vencidos corretamente tratados.
6. Aceitação real ainda ausente para cenários de concorrência, cartão, PWA e APK.

A V84 preparada não elimina automaticamente os bloqueadores 5 e 6. Não é um release estável.

## O que a V84 implementa

- Ação rápida passa a gravar conta, transação e fila numa transação Dexie; lê saldo dentro da transação, exige conta e usa categorias reais.
- Repetir a mesma ação rápida/transferência reutiliza identidade estável. Transferência nova tem duas pernas, direção explícita e IDs UUID.
- Sync troca upserts independentes por um RPC transacional e uma outbox persistente. Resposta perdida repete exatamente o lote original; edições posteriores ficam em outra revisão.
- O servidor verifica deltas de contas contra os efeitos do ledger. Em conflito exclusivamente aditivo, aplica `saldo remoto atual + delta comprovado`; alterações de metadados conflitantes são retidas para revisão.
- Pull completo paginado, proteção revalidada sob transação local e cursor observado no servidor. Páginas incompletas não autorizam deleções.
- IndexedDB v7 acrescenta apenas a outbox, preservando tabelas existentes. Fila antiga sem base verificável é preservada e marcada para revisão, sem inferir um saldo.
- Contratos SQL aceitam campos/tipos financeiros já utilizados pelo app. Versões remotas passam a ser carimbadas pelo servidor. Não há recálculo dos saldos existentes.
- Edição/exclusão isolada de transferência é bloqueada. Ainda não existe nesta entrega um editor pareado nem migração automática das transferências antigas.
- Home e Análise usam o contexto do layout; não mantêm um segundo provider independente.
- Webhook preparado remove a declaração duplicada, autentica entrada e valida destino financeiro antes de upload. Push preparado exige autenticação e reserva entrega por notificação/assinatura.
- Permissão de administrador do perfil passa a ser controlada no servidor.

## Limites e próximo trabalho

A concorrência de metadados continua exigindo revisão. Uma fila legada sem base não pode ser "curada" inventando a diferença de saldo. O bloqueio conservador pode reter o lote completo desse usuário; o painel de diagnóstico/recuperação da V86 deve tornar a revisão compreensível. Antes da ativação, a fila legada precisa ser examinada no dispositivo.

Testes de handlers usam dependências simuladas; não equivalem a um cold start Deno, Evolution autenticada ou entrega push real. Não foram enviados WhatsApps/pushes. Não foram alterados secrets, banco, funções publicadas, GitHub, Vercel ou assinatura Android.

Os contratos antigos que exigem "timestamp remoto mais novo vence e consome a fila" (especialmente V64) não podem permanecer como autoridade: essa regra causa o defeito auditado. O gate comportamental `npm run finance:check` verifica o novo contrato. Scripts históricos continuam no repositório, sem serem apagados ou artificialmente tornados verdes.

## Produto futuro — não fazer agora

- Fechamento mensal como checklist de exceções, depois que conciliação e saldos convergirem; sem lock contábil prematuro.
- Aprendizado explícito de categoria por regra revisável, com origem e desfazer; sem IA gravando dinheiro sem confirmação.
- Resumo semanal dentro do app primeiro; bot apenas quando solicitado. Nada de feed genérico de descobertas.
- Eventos de Site/Entregas via integração com idempotência e owner financeiro no Finance; não acoplar bancos.
- Não criar mais uma Home, Inbox paralela, segundo motor de projeção ou dashboard com mais cards.

## Minha decisão de produto

Se fosse meu sistema principal, eu priorizaria confiança e uma revisão diária curta: "há algo errado ou algo que exige decisão?". Só depois adicionaria inteligência nova. A ação mais valiosa agora é reduzir as formas de o mesmo fato financeiro virar números diferentes.
