import fs from 'node:fs'
const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (condition, message) => {
  if (!condition) throw new Error(`V59: ${message}`)
  console.log(`OK: ${message}`)
}
const planning = read('src/lib/financialPlanning.ts')
const center = read('src/components/financial/FinancialHealthCenter.tsx')
const analysis = read('src/app/(app)/analysis/page.tsx')
const home = read('src/app/(app)/home/page.tsx')
const engine = read('src/lib/financial-intelligence/engine.ts')

ok(planning.includes('buildFinancialPlan') && planning.includes('simulateFinancialScenario'), 'planejamento e cenários usam contrato central')
ok(planning.includes("tx.status !== 'pending'") && planning.includes('projectedMonthExpense'), 'planejamento separa realizado, pendente e estimativa')
ok(center.includes('Saúde e planejamento do mês') && center.includes('Simular cenário'), 'Centro Financeiro expõe saúde e cenários')
const scenarioFn = planning.match(/export function simulateFinancialScenario[\s\S]*?\n}/)?.[0] || ''
const forbiddenScenarioWrites = [
  /\bdb\s*\./,
  /\b(?:add|put|update|delete|bulkAdd|bulkPut|bulkDelete)\s*\(/,
  /\b(?:safeCreate|safeUpdate|safeDelete|enqueueSync|syncQueue)\b/,
  /\bfetch\s*\(/,
  /\bsupabase\b/,
]
ok(
  scenarioFn.includes('return {') &&
  !forbiddenScenarioWrites.some((pattern) => pattern.test(scenarioFn)) &&
  center.includes('useState') &&
  center.includes('useMemo') &&
  center.includes('simulateFinancialScenario'),
  'cenário é não destrutivo por contrato: cálculo puro + estado local, sem persistência'
)
ok(analysis.includes('<FinancialHealthCenter') && analysis.includes('financialIntelligence'), 'Análises integra Centro Financeiro ao motor V54')
ok(analysis.includes('Por que o Finance mostrou isso?') && analysis.includes('insight.explanation.why'), 'explicabilidade V54 aparece na interface')
ok(home.includes('Centro financeiro') && home.includes("router.push('/analysis#intelligence')"), 'Home aponta para centro consolidado')
ok(engine.includes('buildPriorityScore') && engine.includes('buildRobustDailyExpense'), 'motor V54 permanece autoridade de ranking e projeção robusta')
ok(!planning.includes('db.') && !planning.includes('supabase'), 'cenários não criam persistência paralela')
console.log('DFL FINANCE V59 INTELLIGENCE + PLANNING: OK')
