# V85 — um contrato financeiro compartilhado

Base: V84 já aplicada e validada no Termux. Este pacote não instala dependências, não publica, não altera banco e não executa build.

## Mudanças

- Compromissos resolvidos por um único serviço para Home, Centro Financeiro, linha do tempo e gráfico. Fontes são transações, faturas/ciclos, recebíveis, contratos de empréstimo e cronograma de financiamento.
- Disponível operacional da Home: saldo de contas ativas do contexto menos compromissos vencidos/hoje. O disponível mensal no Centro usa o mesmo serviço até o fim do mês. São horizontes diferentes, explicitamente nomeados. Receitas não recebidas não aumentam nenhum disponível.
- Despesas vencidas entram em hoje no horizonte. Recebimentos vencidos sem nova data confirmada ficam fora da projeção e geram aviso, preservando o recebível original.
- Compras de cartão são despesa econômica na data da compra; pagamento de fatura é caixa, não segunda despesa. Uma fatura é deduplicada pelo ciclo/vínculo explícito, com pagamento parcial abatido e novas compras consideradas. Sem fatura materializada, usa o ciclo calculado pela regra de cartão já existente.
- Todas as parcelas futuras materializadas entram no horizonte, sem somar novamente o resumo do contrato. Sem cronograma materializado de financiamento, somente o próximo vencimento verificável entra; a lacuna é explicada.
- Empréstimos têm sinal conforme direção; principal não vira despesa/receita econômica. Parcela explicitamente cadastrada mais principal restante não duplicam a obrigação.
- Um estimador compartilhado usa dias civis, janela de até 90 dias, dias sem observação como zero desde o primeiro dado e P90 nos dias positivos. Para extrapolar, exige ao menos três dias positivos e sete dias de observação. Um lançamento excepcional isolado fica integralmente no realizado, sem ser multiplicado no futuro.
- Projeção mensal preserva todo o realizado e estima somente o período restante. Caixa e resultado econômico possuem bases separadas, calculadas pela mesma função; não se soma pagamento de cartão ao resultado novamente.
- Confiança considera duração e dias independentes, além de quantidade de lançamentos. A confiança exibida no Centro Financeiro corresponde à base de caixa; insights econômicos usam a base econômica.
- Gráfico, baseline do cenário de 30/90 dias e compromissos usam o mesmo cálculo de caixa. Risco considera o pior ponto do horizonte, não apenas o saldo final.
- Cenário não grava dados. Impacto líquido inclui alocação imediata em dívida; redução de gasto fica limitada à estimativa, preservando parcelas/faturas conhecidas. Não inventa economia de juros.
- Descoberta de caixa saudável exige eventos, cobertura e confiança suficiente. Dados sem data/direção verificável geram aviso, sem falsificar confiança.

## Limites deliberados

Assinatura configurada não é somada silenciosamente como outra despesa quando não existe vínculo explícito com lançamento. Continua sendo planejamento e exposição mensal; a explicação informa isso. Não há aprendizado de preço ou automação destrutiva.

A projeção trata recebimento futuro datado como condicional à confirmação. Estatística residual não é promessa nem deduplicação contábil: ela cobre apenas a parcela da tendência ainda não representada pelos compromissos do horizonte. O motor não prevê juros ausentes, novas compras específicas ou contratos sem direção/data.

Não houve backfill, recálculo de saldos, alteração de dados históricos, deploy, APK ou assinatura Android. A gestão pareada completa de transferências ainda não está nesta entrega: a proteção contra edição/exclusão isolada da V84 continua ativa. A V86 deve revisar essa experiência antes do release.

## Aplicação e validação

O instalador verifica os hashes dos arquivos esperados da V84, preserva modificações fora do manifesto, salva backup, aplica somente o escopo e roda `node scripts/check-v85-financial-brain.mjs`. Falha restaura somente o manifesto; não reinstala dependências. Uma nova execução de pacote integralmente aplicado apenas valida; mistura parcial/edições inesperadas abortam.

O gate inclui os testes e verificações da V84 mais 17 casos financeiros da V85: receita pendente/disponível, vencidos, fatura/pagamento parcial, compra depois de fatura paga, ciclo legado, contexto/transferência/metas, dívida vinculada, empréstimo, outlier, realizado intacto, risco temporário, baseline compartilhada, cenário, qualidade de dados, assinatura sem vínculo e cronograma de financiamento.

Após V86: ativar o backend preparado da V84 em duas fases, publicar PWA, executar aceitação financeira com dados reais e só depois release gate/APK. Até essa ativação, os gates locais não certificam o comportamento do backend publicado.
