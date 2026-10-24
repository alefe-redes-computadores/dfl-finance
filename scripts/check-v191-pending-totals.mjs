import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const source = fs.readFileSync(
  'src/app/(app)/transactions/page.tsx', 'utf8'
)

const flow = fs.readFileSync(
  '.github/workflows/android-build.yml', 'utf8'
)

let count = 0

function test(name, fn) {
  fn()
  count++
  console.log('✓', name)
}

test('Sintaxe TSX válida', () => {
  const parsed = ts.createSourceFile(
    'transactions/page.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  assert.equal(parsed.parseDiagnostics.length, 0)
})

test('Totais usam useMemo', () => {
  assert.ok(source.includes('const pendingTotals = useMemo('))
})

test('Dependências completas', () => {
  assert.ok(source.includes(
    '[pendingSummaryTxs, debtReceivablesForPeriod]'
  ))
})

test('Mantém classificação de contas a pagar', () => {
  assert.ok(source.includes(
    "getPendingDirection(tx) === 'payable'"
  ))
})

test('Mantém classificação das contas a receber', () => {
  assert.ok(source.includes(
    'isStandalonePendingReceivable(tx)'
  ))
})

test('Mantém conversão de valores financeiros', () => {
  assert.ok(source.includes('payable += safeNum(tx.amount)'))
  assert.ok(source.includes('receivableTransactions += safeNum(tx.amount)'))
  assert.ok(source.includes('receivableDebts += safeNum(debt.remaining)'))
})

test('Mantém total de transações separado', () => {
  assert.ok(source.includes(
    'const pendingReceivableTxTotal = pendingTotals.receivableTransactions'
  ))
})

test('Mantém total de dívidas separado', () => {
  assert.ok(source.includes(
    'const pendingDebtTotal = pendingTotals.receivableDebts'
  ))
})

test('Mantém soma final a receber', () => {
  assert.ok(source.includes(
    'pendingReceivableTxTotal + pendingDebtTotal'
  ))
})

test('Filtro de pendências V190 preservado', () => {
  assert.ok(source.includes('const pendingSummaryTxs = useMemo('))
})

test('Agrupamento V189 preservado', () => {
  assert.ok(source.includes('const grouped = useMemo('))
})

test('Busca V188 preservada', () => {
  assert.ok(source.includes('useDeferredValue(search)'))
})

test('Transferências preservadas', () => {
  assert.ok(source.includes('transfer_group_id'))
})

test('Exportação CSV preservada', () => {
  assert.ok(source.includes('exportTransactionsToCSV'))
})

test('Workflow Android exige V191', () => {
  assert.ok(flow.includes(
    'node scripts/check-v191-pending-totals.mjs'
  ))
})

// Comparação funcional independente da página.
const payable = tx => tx.direction === 'payable'
const receivable = tx => tx.standaloneReceivable === true
const amount = tx => tx.amount

const original = (transactions, debts) => ({
  payable: transactions.filter(payable)
    .reduce((sum, tx) => sum + amount(tx), 0),
  receivableTransactions: transactions.filter(receivable)
    .reduce((sum, tx) => sum + amount(tx), 0),
  receivableDebts: debts
    .reduce((sum, debt) => sum + debt.remaining, 0)
})

const consolidated = (transactions, debts) => {
  let a = 0
  let b = 0
  let c = 0

  for (const tx of transactions) {
    if (payable(tx)) a += amount(tx)
    if (receivable(tx)) b += amount(tx)
  }

  for (const debt of debts) c += debt.remaining

  return {
    payable: a,
    receivableTransactions: b,
    receivableDebts: c
  }
}

test('Totais equivalentes em cenário misto', () => {
  const transactions = [
    { amount: 100, direction: 'payable' },
    { amount: 250, standaloneReceivable: true },
    { amount: 45, direction: 'payable' },
    { amount: 10, standaloneReceivable: true }
  ]
  const debts = [
    { remaining: 70 },
    { remaining: 30 }
  ]

  assert.deepEqual(
    consolidated(transactions, debts),
    original(transactions, debts)
  )
})

test('Totais equivalentes com listas vazias', () => {
  assert.deepEqual(
    consolidated([], []),
    original([], [])
  )
})

console.log(`V191: ${count} contratos aprovados.`)
