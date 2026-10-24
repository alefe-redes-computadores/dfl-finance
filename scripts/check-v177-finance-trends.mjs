import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const engine = 'src/lib/financeTrends.ts'
const page = 'src/app/(app)/financial-trends/page.tsx'
const source = fs.readFileSync(engine, 'utf8')
const ui = fs.readFileSync(page, 'utf8')

let tests = 0
const check = (name, fn) => {
  fn()
  tests++
  console.log('✓', name)
}

for (const file of [engine, page]) {
  check(`Sintaxe: ${file}`, () => {
    const parsed = ts.createSourceFile(
      file,
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    assert.equal(parsed.parseDiagnostics.length, 0)
  })
}

const paths = [
  'src/lib/financePace.ts',
  'src/lib/financeMonthlyReview.ts',
  engine
]
const compiled = new Map()

for (const path of paths) {
  compiled.set(path, ts.transpileModule(
    fs.readFileSync(path, 'utf8'),
    {
      fileName: path,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }
  ).outputText)
}

const cache = new Map()
const dependencies = {
  './financePace': paths[0],
  './financeMonthlyReview': paths[1]
}

const load = path => {
  if (cache.has(path)) return cache.get(path)
  const result = {}
  cache.set(path, result)
  new Function('exports', 'require', compiled.get(path))(
    result,
    spec => {
      const target = dependencies[spec]
      assert.ok(target, `Dependência inesperada: ${spec}`)
      return load(target)
    }
  )
  return result
}

const { buildFinanceTrends } = load(engine)

let id = 0
const row = (date, type, amount, more = {}) => ({
  id: `t-${++id}`,
  context: 'dfl',
  date,
  type,
  amount,
  status: 'done',
  affects_balance: true,
  account_id: 'bank',
  category_id: 'food',
  ...more
})
const categories = [{ id: 'food', name: 'Alimentação' }]
const date = '2026-10-24'
const calc = (rows, context = 'dfl') =>
  buildFinanceTrends(rows, categories, context, date)

check('Sem dados não inventa média', () => {
  const x = calc([])
  assert.equal(x.incomeAverage, null)
  assert.equal(x.expenseAverage, null)
  assert.equal(x.expenseTrendPercent, null)
})
check('Histórico usa seis meses completos', () => {
  const x = calc([])
  assert.equal(x.completeHistory.length, 6)
  assert.equal(x.completeHistory[0].month, '2026-04')
  assert.equal(x.completeHistory[5].month, '2026-09')
})
check('Outubro incompleto não entra no histórico', () => {
  const x = calc([row('2026-10-01', 'income', 100)])
  assert.equal(x.monthsWithRecords, 0)
  assert.equal(x.currentIncome, 100)
})
check('Contexto pessoal isolado', () => {
  const rows = [row('2026-09-10', 'income', 200, {
    context: 'personal'
  })]
  assert.equal(calc(rows).monthsWithRecords, 0)
  assert.equal(calc(rows, 'personal').monthsWithRecords, 1)
})
check('Receita pendente não é realizada', () => {
  assert.equal(calc([
    row('2026-09-10', 'income', 200, {
      status: 'pending'
    })
  ]).monthsWithIncome, 0)
})
check('Transferência não conta como receita', () => {
  assert.equal(calc([
    row('2026-09-10', 'income', 200, {
      transfer_group_id: 'transfer'
    })
  ]).monthsWithIncome, 0)
})
check('Fatura não duplica gasto', () => {
  assert.equal(calc([
    row('2026-09-10', 'expense', 100, {
      invoice_id: 'inv'
    })
  ]).monthsWithExpenses, 0)
})
check('Compra no cartão conta economicamente', () => {
  assert.equal(calc([
    row('2026-09-10', 'expense', 100, {
      credit_card_id: 'card',
      status: 'pending'
    })
  ]).monthsWithExpenses, 1)
})
check('Média exige três meses observados', () => {
  const x = calc([
    row('2026-07-10', 'income', 100),
    row('2026-08-10', 'income', 200),
    row('2026-09-10', 'income', 300)
  ])
  assert.equal(x.incomeAverage, 200)
})
check('Receitas constantes têm variação zero', () => {
  const x = calc([
    row('2026-07-10', 'income', 100),
    row('2026-08-10', 'income', 100),
    row('2026-09-10', 'income', 100)
  ])
  assert.equal(x.incomeVariability, 0)
})
check('Mês ausente não equivale a receita zero', () => {
  const x = calc([
    row('2026-07-10', 'income', 100),
    row('2026-09-10', 'income', 100)
  ])
  assert.equal(x.incomeAverage, null)
})
check('Tendência exige seis meses com gastos', () => {
  const x = calc([
    row('2026-07-10', 'expense', 100),
    row('2026-08-10', 'expense', 200),
    row('2026-09-10', 'expense', 300)
  ])
  assert.equal(x.expenseTrendPercent, null)
})
check('Tendência completa calcula aumento', () => {
  const months = ['04','05','06','07','08','09']
  const rows = months.map((m, i) =>
    row(`2026-${m}-10`, 'expense', i < 3 ? 100 : 150)
  )
  assert.equal(calc(rows).expenseTrendPercent, 50)
})
check('Tendência completa calcula queda', () => {
  const months = ['04','05','06','07','08','09']
  const rows = months.map((m, i) =>
    row(`2026-${m}-10`, 'expense', i < 3 ? 200 : 100)
  )
  assert.equal(calc(rows).expenseTrendPercent, -50)
})
check('Prioridades são ordenadas', () => {
  const s = calc([]).signals
  assert.deepEqual(
    s.map(x => x.priority),
    s.map(x => x.priority).sort((a, b) => a - b)
  )
})
check('Motor não altera arrays', () => {
  const rows = [row('2026-09-10', 'expense', 100)]
  const before = JSON.stringify(rows)
  calc(rows)
  assert.equal(JSON.stringify(rows), before)
})
check('Nenhum acesso de escrita no motor', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|safeAdd|safeUpdate|supabase\./.test(source))
})
check('Nenhum acesso de escrita na página', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|safeAdd|safeUpdate/.test(ui))
})
check('Contexto ativo na interface', () => {
  assert.ok(ui.includes('effectiveContext'))
  assert.ok(ui.includes('<ContextToggle/>'))
})
check('Menu Mais tem rota uma única vez', () => {
  const more = fs.readFileSync(
    'src/app/(app)/more/page.tsx', 'utf8'
  )
  assert.equal(
    (more.match(/href="\/financial-trends"/g) || []).length, 1
  )
})
check('Preserva acesso a V175', () => {
  assert.ok(ui.includes("'/monthly-review'"))
})
check('Preserva acesso a V176', () => {
  assert.ok(ui.includes("'/financial-health'"))
})
check('Preserva contratos anteriores', () => {
  for (let v = 172; v <= 176; v++) {
    assert.ok(fs.existsSync({
      172: 'scripts/check-v172-spending-pulse.mjs',
      173: 'scripts/check-v173-financial-planning.mjs',
      174: 'scripts/check-v174-finance-pressure.mjs',
      175: 'scripts/check-v175-monthly-review.mjs',
      176: 'scripts/check-v176-finance-health.mjs'
    }[v]))
  }
})

console.log(`V177: ${tests} contratos aprovados.`)
