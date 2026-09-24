import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (condition, message) => {
  if (!condition) throw new Error(message)
}

const home = read('src/app/(app)/home/page.tsx')
const tx = read('src/app/(app)/transactions/page.tsx')
const conci = read('src/app/(app)/conciliation/page.tsx')
const accounts = read('src/app/(app)/accounts/page.tsx')
const accountPresentation = read('src/lib/accountPresentation.ts')
const categories = read('src/app/(app)/categories/page.tsx')
const projection = read('src/hooks/useProjection.ts')
const metrics = read('src/lib/financialMetrics.ts')

ok(
  conci.includes("const conciliationCutoff = localIsoDate(new Date())") &&
  conci.includes("date <= conciliationCutoff"),
  'Conciliação ainda aceita futuro.'
)

ok(
  home.includes("date <= todayIso") &&
  home.includes("pendingDate > todayIso"),
  'Home ainda mistura pendência futura na operação.'
)

ok(
  tx.includes("quickFilter === 'pending'") &&
  tx.includes("String(t.date || '').slice(0, 10) > todayIso") &&
  tx.includes("tx.date > todayIso"),
  'Transações: contrato de pendências vencidas/hoje ausente.'
)

ok(
  accounts.includes("'manual' | 'balance' | 'institution' | 'name'") &&
  accounts.includes('dfl_accounts_manual_order_') &&
  accounts.includes("moveAccount(String(account.id), 'up')") &&
  accounts.includes("moveAccount(String(account.id), 'down')"),
  'Contas: ordenação manual incompleta.'
)

ok(
  accountPresentation.includes('preserveInputOrder = false') &&
  accountPresentation.includes('if (preserveInputOrder) return result'),
  'Agrupamento de contas está destruindo a ordem manual.'
)

/*
 * Categorias padrão: o estado atual já implementava o contrato seguro.
 * V33 não troca histórico por exclusão forçada.
 */
ok(
  categories.includes('const wasDefault = Boolean(deleteTarget.is_default)') &&
  categories.includes("{ is_default: false }") &&
  categories.includes("safeDelete(") &&
  categories.includes("{ is_default: true }"),
  'Proteção de categorias padrão regrediu.'
)

/*
 * Projeção: mantém saldo real + apenas transações realizadas,
 * sem transformar "Quem me deve" em despesa.
 */
ok(
  projection.includes('getContextBalance(accounts, context)') &&
  projection.includes('isRealizedFinancialTransaction') &&
  projection.includes('isExpenseTransaction') &&
  projection.includes('const pendingDebts') &&
  !projection.includes('runningBalance -= pendingDebts'),
  'Contrato da projeção financeira regrediu.'
)

ok(
  metrics.includes("transaction.status !== 'done'") &&
  metrics.includes('transaction.affects_balance === false') &&
  metrics.includes('transaction.goal_id'),
  'Métricas voltaram a contar itens não realizados/contábeis.'
)

console.log('DFL FINANCE V33 MACRO: OK')
