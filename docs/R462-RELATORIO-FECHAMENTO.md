# DFL Finance — R462, fechamento de integridade comercial

**Base:** R461 `d3dec7917de28f863a9e14980f12987bbe0fecb1` (GitHub main).
**Natureza:** aplicação somente local, sem alteração automática em Supabase/Vercel/Android.
**Decisão pré-homologação:** GO técnico condicional para revisão; ledger comercial requer teste real de resposta perdida, atualização concorrente e grande volume para certificação operacional.

## O que foi corrigido

1. **Intenção de alocação durável:** usa RPC `dfl_commercial_allocate_idempotent` já implantado no banco, com `p_idempotency_key` UUID; salva usuário, loja, plataforma, venda, repasse e valor em armazenamento local ANTES da primeira RPC. Reabertura e retry reutilizam identidade/payload. A confirmação remove a intenção; falha mantém botão para retomá-la. Nunca reutiliza uma chave anterior com payload diferente.
2. **Paginação:** cinco fontes comerciais paginadas (lojas, plataformas, vendas, repasses, alocações), cada uma com ordenação estável por `id`, cursor por UUID, checagem de duplicatas, contagem inicial e revalidação final. As fontes transacionais recebem filtros de proprietário, loja e plataforma ANTES da paginação. Erro, sobrecarga acima do limite de memória ou divergência bloqueia totais e operação comercial, sem publicar dados parciais.
3. **UI:** agregações de saldos por mapa linear em vez de filtros repetidos por venda/repasse; histórico progressivo em blocos de 30.
4. **Comprovantes:** o tipo MIME já validado define a extensão física de novos uploads; URL de JPG/JFIF e JPE antigos é aceita pela validação de URL assinada do proprietário. O bucket continua privado; nenhuma origem ou caminho público são autorizados.
5. **Documentação:** README, CHANGELOG, histórico dentro do aplicativo e gate Android atualizados. O changelog R461 deixa de dizer 'pendente'.

## Garantias importantes e limitações

- O PostgreSQL já tem a função `dfl_commercial_allocate_idempotent` e índice único de `(owner_id,idempotency_key)`. Nenhuma nova migração foi solicitada ou aplicada.
- Idempotência vale para a **mesma intenção e mesma chave**, persistida no dispositivo. Outro dispositivo não necessariamente recupera a chave local; o aplicativo deve orientar a checar o histórico antes de criar outra alocação após falha em dispositivo distinto.
- Dupla contagem garante **completude de registros observada**, não um snapshot transacional simultâneo das três tabelas, especialmente se alocações forem revertidas durante a leitura. Conciliação contábil definitiva em ambiente altamente concorrente exige agregação transacional do lado servidor e homologação específica. Não anunciar dados client-side como prova irrevogável.
- O limite de proteção `COMMERCIAL_MAX_ROWS = 50000` por fonte bloqueia os totais caso excedido — nunca trunca silenciosamente. Em cenário desse porte, migrar para agregação transacional no servidor.
- `localStorage` é uma fila de uma intenção por proprietário e dispositivo. Sem acesso WebCrypto/storage, a operação é bloqueada antes de chamar o RPC, não usa chave aleatória fraca.
- Não houve testes no Android real, nem chamadas SQL de escrita, WhatsApp, Evolution, migrações ou modificação de produção durante a preparação do pacote. Não inventar resultado E2E.

## Gates exigidos

- `scripts/check-r462-closeout.mjs` e testes Jest `commercialR462.test.ts` + `receiptR462.test.ts`.
- R461, R460, R459, R458, R457, R456; V35.2 de comprovantes, V57 importação, R454 comercial; `tsc --noEmit`, ESLint, `mobile:check`, Jest global e `git diff --check`.
- Instalador mantém backup seletivo; publicador só atua após aprovação e hashes do mesmo código.

## Testes práticos após Action APK certificada

- Criar alocação de teste em ambiente isolado e reproduzir perda da resposta; reabrir o app e confirmar que a mesma intenção retorna um único ID.
- Simular duas tentativas concorrentes com mesma chave e payload diferente (esperar erro, não duplicação); conferir saldo de venda/repasse.
- Inserir mais de 1000 linhas fictícias num ambiente isolado; consultar diferentes lojas e plataformas, revisar totais e falha parcial.
- Testar JPEG `.jfif`, `.jpe`, `.jpeg`, imagens PNG com nomes enganosos e comprovantes antigos sem permitir acesso de outro usuário.
- Testar tela escura/clara, teclado, offline/reconexão, notas de atualização e fluxo habitual de bot (sem criar dinheiro artificial na produção).
