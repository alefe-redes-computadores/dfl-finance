# V84 — ativação e aceitação

Esta entrega prepara código e backend. Não publica nem aplica banco automaticamente. A primeira etapa é aplicar o pacote local e validar. Não executar build no Termux.

## Aplicação local

Execute o arquivo baixado com `bash`. O diretório padrão é `~/projects/dfl-finance`. O script exige main no HEAD inspecionado, compara a main remota, recusa alterações em qualquer arquivo que tocará e preserva arquivos históricos não rastreados.

Ele cria um backup dos arquivos tocados, registra HEAD/status, instala dependências com lockfile e executa TypeScript, testes financeiros IndexedDB, Postgres WASM isolado, handlers simulados, contratos mobile, ESLint e diff check. Se houver falha, restaura somente o manifesto de arquivos que alterou. Não faz staging, commit, push, deploy, limpeza, stash ou reset. Não lê credentials para publicar. O relatório e o rollback local ficam no backup indicado ao final.

A instalação de dependências precisa de internet e altera node_modules. O rollback restaura os manifests e tenta reinstalar as dependências anteriores; se essa reinstalação falhar, o código permanece restaurado e o erro é informado.

## Ativação em duas fases

1. **Preflight e backup privado.** Confirmar novamente HEAD/deploy/schema/functions; executar `scripts/preflight-v84-financial.sql` somente leitura. Fazer backup nativo do banco e Storage; guardar versões dos handlers publicados e secrets por mecanismo seguro, sem imprimir valores. Exportar recuperação de Empresa e Pessoal e preservar IndexedDB/fila antes da atualização. O backup atual do app não inclui integralmente fila/outbox: não limpar armazenamento nem reinstalar PWA para tentar resolver pendências.
2. **Revisar legado no dispositivo.** Fila antiga sem `_sync_base` não deve ser regravada como saldo novo. Sincronizar a versão atual e conferir saldo/trilha antes da atualização, ou tratar cada operação com comparação privada. Não reenviar backlog do bot em massa.
3. **Instalar migration preparada.** `supabase/migrations/20261009195028_v84_financial_integrity.sql` instala RPC, contratos e proteções. `enforce_atomic` inicia **false**; os clientes antigos continuam podendo gravar até a ativação final. Não existe correção retroativa de saldos nem backfill de pernas antigas. Migration é transacional e não deve ser reaplicada manualmente como script ad hoc.
4. **Verificar chamadas de servidores.** Evolution precisa enviar `x-dfl-webhook-token` correspondente a `DFL_WEBHOOK_SECRET`, ou a credencial `apikey` correspondente à `EVOLUTION_API_KEY`. O disparador de push precisa enviar bearer service-role ou `x-dfl-push-token` correspondente a `DFL_PUSH_SECRET`. Validar configuração real antes de publicar; não presumir compatibilidade só porque existem env vars. Esses segredos nunca vão para o app.
5. **Publicar handlers e app novo, após autorização de commit/push/deploy.** Publicar webhook e push incluindo `_shared/requestSecurity.ts`. Validar cold start real e respostas 401/200 corretas. Publicar a PWA com o novo RPC e confirmar commit do deploy. Usar uma janela controlada de teste: enquanto enforcement está false, clientes antigos ainda podem executar o fluxo inseguro anterior.
6. **Conferir clientes e ativar.** Atualizar PWA(s) e preparar atualização dos APKs antigos. Após aceite de sync e revisão de fila, executar conscientemente `scripts/activate-v84-financial.sql`. Clientes antigos deixam de poder gravar finanças diretamente e precisam atualizar; isso é parte deliberada do contrato, não um retry a ignorar.
7. **Aceitar PWA; somente depois APK.** Não alterar assinatura, Gradle, status bar ou edge-to-edge sem defeito reproduzido. Build Android só no workflow já existente depois do gate de release.

## Aceitação real obrigatória

| Caso | Resultado esperado |
|---|---|
| Despesa rápida; falha após atualizar conta | Nem saldo, nem ledger, nem fila ficam parcialmente alterados |
| Clique repetido/reenvio | Uma operação, um efeito monetário |
| Resposta do RPC perdida após commit | Repetir o lote devolve o mesmo resultado sem reaplicar saldo |
| Duas despesas offline, bot recebe dinheiro durante intervalo | Cada delta aplicado uma vez; saldo final igual ao saldo remoto mais deltas locais |
| Edição enquanto um lote está em voo | Lote original imutável; revisão nova preservada com base atualizada |
| Metadados de conta alterados por dois clientes | Conflito explícito; nenhuma sobrescrita silenciosa |
| Transferência entre contextos | Duas contas afetadas uma vez, dois registros, um movimento visual; receita/despesa não infladas |
| Excluir/editar uma perna antiga | Operação genérica bloqueada, sem reversão errada |
| Compra, troca de cartão, pagamento de fatura | Limites corretos; um débito de caixa; lote completo |
| Empréstimo concedido/recebido e parcela financiamento | Contrato aceito; sinal de caixa conforme direção; nenhum campo perdido |
| Mais de uma página e falha na segunda página | Nenhum prune baseado em lista parcial |
| Reabertura offline; atualização IndexedDB | Registros, pendências e outbox preservados |
| Imagem arbitrária e comprovante em contexto válido | Arbitrária ignorada antes de Storage; comprovante vinculado e privado |
| Replay de confirmação de recebimento no WhatsApp | Chave estável; RPC idempotente; nenhum segundo crédito |
| Chamadas sem credencial | Webhook/push negam antes de acessar dados |

Também conferir fluxo contextual: Transações → + inferior → formulário completo; demais telas → Ação rápida. Selecionar contexto e validar que Home, Análise, conta e categoria seguem a mesma escolha.

## Rollback

- **Falha antes de executar o app novo:** usar rollback local gerado, que restaura arquivos e manifests sem operações destrutivas de Git.
- **Falha na migration:** a transação aborta. Não tentar corrigir saldos manualmente. Recolher diagnóstico e revisar o patch.
- **Falha de endpoint:** restaurar versão de handler previamente salva e sua configuração compatível, sem replay cego de eventos.
- **Falha após ativação:** `scripts/rollback-v84-enforcement.sql` desliga somente o bloqueio a clientes antigos. Mantém schema, recibos de idempotência e saldos; reabre o risco de escrita antiga, portanto é uma janela de recuperação monitorada.
- **Depois de IndexedDB v7 em uso:** não publicar simplesmente o app v6 nem apagar IndexedDB. A abertura com versão menor pode falhar. O rollback de runtime deve preservar a versão 7/outbox e o protocolo de sync; reparar à frente ou usar build de compatibilidade revisado.
- **Depois de dinheiro confirmado:** rollback de código não reverte dinheiro. Correção financeira precisa de operação compensatória identificada e revisada, com trilha.

## Evidência desta entrega

Gate local: TypeScript, ESLint, 14 testes de IndexedDB/contrato/paginação, 18 cenários Postgres isolado, 8 handlers Edge simulados, 13 contratos de readiness mobile e diff check. Não houve runtime da PWA/Android nem deploy real dos handlers. Não chamar esta entrega de release aprovado antes da aceitação acima.
