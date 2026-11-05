import fs from 'node:fs'

const read = (f) => fs.readFileSync(f, 'utf8')
const planning = read('src/lib/financialPlanning.ts')
const center = read('src/components/financial/FinancialHealthCenter.tsx')
const home = read('src/app/(app)/home/page.tsx')
const inbox = read('src/app/(app)/conciliation/page.tsx')

const checks = [
  [
    planning.includes('buildKnownCashTimeline') &&
      planning.includes('firstRiskDate') &&
      planning.includes('knownIncome') &&
      planning.includes('knownExpense'),
    'timeline conhecida possui fluxo e risco',
  ],
  [
    planning.includes("tx.status !== 'pending'") &&
      planning.includes("tx.type === 'income'") &&
      planning.includes("tx.type === 'expense'"),
    'timeline usa somente pendências financeiras reais',
  ],
  [
    planning.includes('buildFinancialDiscoveries') &&
      planning.includes('known-cash-risk') &&
      planning.includes('negative-month-trend') &&
      planning.includes('low-confidence'),
    'Descobertas cobrem risco, tendência e confiança',
  ],
  [
    center.includes('Descobertas') &&
      center.includes('Como chegamos nesses valores?'),
    'Centro Financeiro ganhou descoberta e explicabilidade',
  ],
  [
    center.includes('Conhecido:') &&
      center.includes('Estimado:') &&
      center.includes('Conhecido e estimado nunca são apresentados como a mesma coisa'),
    'UI distingue conhecido de estimado',
  ],
  [
    center.includes('Linha do tempo conhecida · 30 dias') &&
      center.includes('Risco conhecido em'),
    'timeline de 30 dias aparece no Centro Financeiro',
  ],
  [
    center.includes('Simular cenário') &&
      center.includes('simulateFinancialScenario'),
    'cenário E se foi preservado',
  ],
  [
    planning.includes('nenhuma alteração é gravada no seu financeiro'),
    'simulação continua não destrutiva',
  ],
  [
    home.includes('Inbox financeira') &&
      inbox.includes('Inbox financeira'),
    'V81 operacional permanece integrada',
  ],
]

let failed = 0

for (const [condition, label] of checks) {
  if (condition) {
    console.log(`OK: ${label}`)
  } else {
    failed++
    console.error(`FALHOU: ${label}`)
  }
}

if (failed) {
  console.error(`\nV82: ${failed} contrato(s) falharam.`)
  process.exit(1)
}

console.log('\nV82 CÉREBRO FINANCEIRO: CONTRATOS OK')
