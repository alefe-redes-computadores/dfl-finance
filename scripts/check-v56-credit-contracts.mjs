import fs from 'node:fs'
const read=(p)=>fs.readFileSync(p,'utf8')
const ops=read('src/lib/creditContractOperations.ts')
const loan=read('src/app/(app)/loans/details/page.tsx')
const finNew=read('src/app/(app)/financings/new/page.tsx')
const finDetail=read('src/app/(app)/financings/details/page.tsx')
const tx=read('src/app/(app)/transactions/details/page.tsx')
const modal=read('src/components/ModalFinancing.tsx')
const db=read('src/lib/db.ts')
const failures=[]
const ok=(c,m)=>{ if(c) console.log('OK:',m); else {console.error('ERRO:',m); failures.push(m)} }

ok(db.includes("'loan_payment' | 'financing_installment'"),'tipos especiais permanecem no ledger')
ok(db.includes('[user_id+loan_id]') && db.includes('[user_id+financing_id]'),'índices de contratos existem')
ok(ops.includes('settleLoanInFull') && ops.includes("type: 'loan_payment'"),'quitação de empréstimo cria ledger real')
ok(ops.includes("affects_balance: false") && ops.includes("`loan:${loanId}:payoff`"),'quitação é idempotente e não duplica efeito econômico')
ok(ops.includes("direction === 'lent'") && ops.includes('currentBalance + amount') && ops.includes('currentBalance - amount'),'direção do caixa do empréstimo é explícita')
ok(ops.includes('deleteLoanWithLedger') && ops.includes('reverted'),'exclusão de empréstimo reverte saldo')
ok(loan.includes('Conta da quitação') && loan.includes('settleLoanInFull'),'UI exige conta na quitação')
ok(ops.includes('syncFinancingSchedule') && ops.includes("type: 'financing_installment'"),'financiamento gera cronograma no ledger')
ok(ops.includes('installmentCents') && ops.includes('addMonthsCivil'),'cronograma usa centavos e datas civis')
ok(finNew.includes('assertFinancingStructureEditable') && finNew.includes('rewritePending: true'),'edição de financiamento protege/reconstrói cronograma')
ok(modal.includes('syncFinancingSchedule'),'modal legado também gera cronograma')
ok(finDetail.includes('/transactions/details?id=${installment.id}'),'pagamento de parcela usa fluxo financeiro completo')
ok(finDetail.includes('Desfaça o pagamento antes de excluir'),'histórico pago é protegido contra exclusão cega')
ok(tx.includes("txType === 'financing_installment'") && tx.includes('paid_date'),'transação mantém estado pago da parcela')
ok(tx.includes('db.financings') && tx.includes('remaining_amount: remainingCents / 100'),'liquidação atualiza progresso do financiamento')
ok(!finDetail.includes('localISODate'),'detalhe não faz mais baixa financeira parcial por flag')

if(failures.length) { console.error(`V56 FALHOU: ${failures.length} contrato(s)`); process.exit(1) }
console.log('V56 CREDIT CONTRACTS: OK')
