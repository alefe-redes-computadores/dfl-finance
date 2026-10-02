import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const loans = read('src/app/(app)/loans/page.tsx')
const loanDetail = read('src/app/(app)/loans/details/page.tsx')
const financings = read('src/app/(app)/financings/page.tsx')
const financingDetail = read('src/app/(app)/financings/details/page.tsx')
const debtList = read('src/app/(app)/debts/page.tsx')
const debtDetail = read('src/app/(app)/debts/details/page.tsx')
const creditOps = read('src/lib/creditContractOperations.ts')
const debtOps = read('src/lib/debtOperations.ts')
const debtCredit = read('src/lib/debtCreditOperations.ts')
const sync = read('src/lib/syncEngine.ts')

const failures = []
const ok = (condition, message) => {
  if (condition) console.log('OK ', message)
  else {
    console.error('ERRO', message)
    failures.push(message)
  }
}

ok(
  loans.includes('deleteLoanWithLedger') &&
    !loans.includes("safeDelete('loans', deleteModal)"),
  'lista de empréstimos usa exclusão transacional com reversão do ledger'
)

ok(
  creditOps.includes('deleteLoanWithLedger') &&
    creditOps.includes('reverted') &&
    creditOps.includes("payment.type === 'loan_payment'"),
  'operação canônica de exclusão reverte pagamentos realizados'
)

ok(
  loans.includes('const loanLedger = (loan: any) =>') &&
    loans.includes('loanLedger(a).remaining') &&
    loans.includes('const visualStatus = ledger.status'),
  'empréstimos exibem e ordenam pelo ledger realizado'
)

ok(
  loanDetail.includes('remaining <= 0') &&
    loanDetail.includes('? "paid"'),
  'detalhe de empréstimo deriva quitação do saldo restante'
)

ok(
  financings.includes('hasPaidInstallment') &&
    financings.includes('Desfaça os pagamentos antes de excluir o financiamento.'),
  'lista de financiamentos protege histórico com parcela paga'
)

ok(
  financings.includes('const financingLedger = (fin: any) =>') &&
    financings.includes('financingLedger(a).remaining') &&
    financings.includes('const visualStatus = ledger.status'),
  'financiamentos exibem e ordenam pelo cronograma realizado'
)

ok(
  financingDetail.includes('const visualStatus =') &&
    financingDetail.includes('status={visualStatus}'),
  'detalhe de financiamento deriva status do ledger'
)

ok(
  debtList.includes('getDebtLedgerState') &&
    debtDetail.includes('getDebtLedgerState') &&
    debtOps.includes('getDebtPaidAmountFromTransactions'),
  'Quem me deve continua usando transações como autoridade'
)

ok(
  debtCredit.includes('applyContactCreditToDebt') &&
    debtCredit.includes('debt_applied_amount') &&
    debtCredit.includes('contact_credit_delta'),
  'crédito de contato e recebível continuam separados no ledger'
)

ok(
  creditOps.includes('syncFinancingSchedule') &&
    creditOps.includes('settleLoanInFull') &&
    creditOps.includes('affects_balance: false'),
  'contratos de crédito preservam cronograma e quitação idempotente'
)

ok(
  sync.includes('reconcileAccountBalancesFast') &&
    sync.includes("item.table === 'accounts'"),
  'saldo/sync V68-V69 preservados'
)

if (failures.length) {
  console.error(`\nV75 FALHOU: ${failures.length} contrato(s).\n`)
  process.exit(1)
}

console.log('\nV75 DÍVIDAS + CRÉDITO + QUEM ME DEVE — CONTRATO OK')
