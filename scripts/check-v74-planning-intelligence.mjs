import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (condition, message) => {
  if (!condition) throw new Error(`V74: ${message}`)
  console.log(`OK: ${message}`)
}

const projection = read('src/hooks/useProjection.ts')
const planning = read('src/lib/financialPlanning.ts')
const engine = read('src/lib/financial-intelligence/engine.ts')
const home = read('src/app/(app)/home/page.tsx')
const sync = read('src/lib/syncEngine.ts')

ok(
  projection.includes('knownFlowsByDay') &&
  projection.includes('knownPayables30') &&
  projection.includes('knownReceivables30'),
  'projeção de 30 dias reconhece fluxos futuros conhecidos'
)

ok(
  projection.includes('dailyAverage * 30 - knownPayables30') &&
  projection.includes('estimatedDailyExpense'),
  'estimativa residual não soma compromisso conhecido duas vezes'
)

ok(
  projection.includes("transaction.status !== 'pending'") &&
  projection.includes('!transaction.account_id'),
  'somente pendências de caixa com conta entram como compromisso conhecido'
)

ok(
  projection.includes('futureEnd') &&
  projection.includes('addDays(now, 29)'),
  'horizonte diário permanece explicitamente em 30 dias'
)

ok(
  projection.includes('isRealizedFinancialTransaction') &&
  projection.includes('isExpenseTransaction'),
  'histórico estatístico continua usando somente despesa realizada'
)

ok(
  planning.includes('projectedMonthIncome') &&
  planning.includes('estimatedRemainingIncome') &&
  planning.includes('knownCommitmentNet'),
  'planejamento separa realizado, conhecido e estimado'
)

ok(
  planning.includes('n(snapshot.projectedMonthExpense) -') &&
  planning.includes('n(snapshot.currentMonthExpense) -') &&
  planning.includes('committedPayables'),
  'despesa estimada mensal desconta o que já é compromisso conhecido'
)

ok(
  planning.includes('projectedMonthIncome -') &&
  planning.includes('n(snapshot.currentMonthIncome) -') &&
  planning.includes('probableReceivables'),
  'receita estimada mensal desconta recebíveis já conhecidos'
)

ok(
  planning.includes('n(snapshot.accountBalance) + futureNet'),
  'caixa projetado parte do saldo atual e aplica apenas futuro ainda não realizado'
)

ok(
  planning.includes('simulateFinancialScenario') &&
  !planning.includes('db.') &&
  !planning.includes('supabase'),
  'cenários continuam puros e não destrutivos'
)

ok(
  engine.includes('buildRobustDailyExpense') &&
  engine.includes('projectedMonthExpense'),
  'motor robusto V54 continua autoridade estatística'
)

ok(
  home.includes('Centro financeiro') &&
  home.includes("router.push('/analysis#intelligence')"),
  'Home mantém entrada para explicabilidade consolidada'
)

ok(
  sync.includes('reconcileAccountBalancesFast'),
  'reconciliação rápida V68 permanece instalada'
)

ok(
  !projection.includes('db.accounts.put(') &&
  !projection.includes('db.accounts.update(') &&
  !planning.includes('safeUpdate'),
  'V74 é leitura/cálculo e não escreve saldo'
)

console.log('\nV74 PLANNING + INTELLIGENCE — CONTRATO OK')
