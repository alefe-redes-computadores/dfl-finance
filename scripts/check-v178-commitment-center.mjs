import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const engine = 'src/lib/financeCommitmentCenter.ts'
const page = 'src/app/(app)/commitment-center/page.tsx'

let tests = 0
const check = (name, fn) => {
  fn()
  tests++
  console.log('✓', name)
}

for (const path of [engine, page]) {
  check(`Sintaxe TS válida: ${path}`, () => {
    const parsed = ts.createSourceFile(
      path,
      fs.readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx')
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS
    )
    assert.equal(parsed.parseDiagnostics.length, 0)
  })
}

const source = fs.readFileSync(engine, 'utf8')
const compiled = ts.transpileModule(source, {
  fileName: engine,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText

const exports = {}
new Function('exports', 'require', compiled)(
  exports,
  () => {
    throw new Error('Import runtime inesperado')
  }
)

const { buildCommitmentCenter } = exports
const today = '2026-10-24'
const end = '2026-11-22'

const event = (
  id, date, amount,
  direction = 'expense',
  scope = 'known'
) => ({
  id,
  date,
  amount,
  direction,
  scope,
  kind: scope === 'planning'
    ? 'subscription'
    : 'transaction',
  label: id,
  detail: '',
  href: '/agenda',
  overdue: date < today,
  today: date === today
})

const make = (items = [], override = {}) => {
  const agenda = {
    today, end,
    horizonDays: 30,
    items,
    groups: [],
    dueNowExpense: 0,
    dueNowIncome: 0,
    horizonExpense: 0,
    horizonIncome: 0,
    planningExpense: 0,
    overdueCount: 0,
    knownCount: 0,
    planningCount: 0,
    warnings: []
  }
  const pressure = {
    today, end, days: 30,
    openingBalance: 500,
    endConservative: 350,
    worstConservative: 300,
    endWithReceipts: 450,
    firstNegativeDate: null,
    warnings: [],
    ...override
  }
  return [agenda, pressure]
}

check('Sem eventos não inventa obrigações', () => {
  assert.equal(buildCommitmentCenter(...make()).knownExpense, 0)
})

check('Evento conhecido contabilizado', () => {
  const x = buildCommitmentCenter(...make([
    event('a', today, 100)
  ]))
  assert.equal(x.knownExpense, 100)
  assert.equal(x.knownCount, 1)
})

check('Recebível separado de despesa', () => {
  const x = buildCommitmentCenter(...make([
    event('income', today, 120, 'income')
  ]))
  assert.equal(x.possibleIncome, 120)
  assert.equal(x.knownExpense, 0)
})

check('Assinatura planejada não duplica obrigação', () => {
  const x = buildCommitmentCenter(...make([
    event('subscription', today, 80, 'expense', 'planning')
  ]))
  assert.equal(x.planningExpense, 80)
  assert.equal(x.knownExpense, 0)
})

check('Deduplica evento por ID', () => {
  const e = event('same', today, 90)
  assert.equal(buildCommitmentCenter(...make([e, e])).knownExpense, 90)
})

check('Evento vencido continua visível', () => {
  const x = buildCommitmentCenter(...make([
    event('old', '2026-10-10', 70)
  ]))
  assert.equal(x.overdueExpense, 70)
  assert.equal(x.buckets[0].count, 1)
})

check('Evento futuro agrupado', () => {
  const x = buildCommitmentCenter(...make([
    event('future', '2026-11-10', 20)
  ]))
  assert.equal(x.buckets[2].expense, 20)
})

check('Evento além do horizonte excluído', () => {
  const x = buildCommitmentCenter(...make([
    event('beyond', '2027-01-01', 150)
  ]))
  assert.equal(x.knownExpense, 0)
})

check('Valores inválidos excluídos', () => {
  const x = buildCommitmentCenter(...make([
    event('invalid', today, NaN),
    event('negative', today, -10)
  ]))
  assert.equal(x.knownExpense, 0)
})

check('Não modifica objetos originais', () => {
  const [agenda, pressure] = make([
    event('a', today, 100)
  ])
  const before = JSON.stringify([agenda, pressure])
  buildCommitmentCenter(agenda, pressure)
  assert.equal(JSON.stringify([agenda, pressure]), before)
})

check('Incompatibilidade de horizonte é rejeitada', () => {
  const [agenda, pressure] = make()
  pressure.end = '2026-11-23'
  assert.throws(() => buildCommitmentCenter(agenda, pressure))
})

check('Saldo desconhecido permanece desconhecido', () => {
  const x = buildCommitmentCenter(...make([], {
    openingBalance: null,
    endConservative: null,
    worstConservative: null,
    endWithReceipts: null
  }))
  assert.equal(x.openingBalance, null)
  assert.equal(x.endConservative, null)
})

check('Conservador preserva autoridade do Radar', () => {
  const x = buildCommitmentCenter(...make([
    event('income', today, 999, 'income')
  ]))
  assert.equal(x.endConservative, 350)
  assert.equal(x.endWithReceipts, 450)
})

check('Data negativa gera prioridade', () => {
  const x = buildCommitmentCenter(...make([], {
    firstNegativeDate: '2026-10-27'
  }))
  assert.ok(x.priorities.some(p => p.id === 'negative'))
})

check('Vencidos geram prioridade', () => {
  const x = buildCommitmentCenter(...make([
    event('late', '2026-10-01', 100)
  ]))
  assert.ok(x.priorities.some(p => p.id === 'overdue'))
})

check('Página utiliza motores autoritativos', () => {
  const s = fs.readFileSync(page, 'utf8')
  assert.ok(s.includes('buildFinanceAgenda('))
  assert.ok(s.includes('buildFinancePressure('))
  assert.ok(s.includes('buildCommitmentCenter('))
})

check('Página isola contexto', () => {
  const s = fs.readFileSync(page, 'utf8')
  assert.ok(s.includes('effectiveContext'))
  assert.ok(s.includes('<ContextToggle/>'))
})

check('Página oferece três horizontes', () => {
  assert.ok(fs.readFileSync(page, 'utf8')
    .includes('[7, 30, 90]'))
})

check('Motor não acessa banco', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|safeAdd|safeUpdate/.test(source))
})

check('Página não altera ledger', () => {
  const s = fs.readFileSync(page, 'utf8')
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|safeAdd|safeUpdate/.test(s))
})

check('Menu Mais possui rota única', () => {
  const s = fs.readFileSync('src/app/(app)/more/page.tsx', 'utf8')
  assert.equal(
    (s.match(/href="\/commitment-center"/g) || []).length,
    1
  )
})

check('V177 preservada', () => {
  assert.ok(fs.existsSync('src/lib/financeTrends.ts'))
})

check('V174 preservada', () => {
  assert.ok(fs.existsSync('src/lib/financePressure.ts'))
})

console.log(`V178: ${tests} contratos aprovados.`)
