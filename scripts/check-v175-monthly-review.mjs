import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const engineFile = 'src/lib/financeMonthlyReview.ts'
const pageFile = 'src/app/(app)/monthly-review/page.tsx'
const engine = fs.readFileSync(engineFile, 'utf8')
const page = fs.readFileSync(pageFile, 'utf8')

let checks = 0
const test = (name, fn) => {
  fn()
  checks++
  console.log('✓', name)
}

for (const [path, source, kind] of [
  [engineFile, engine, ts.ScriptKind.TS],
  [pageFile, page, ts.ScriptKind.TSX]
]) {
  test(`Sintaxe válida: ${path}`, () => {
    const file = ts.createSourceFile(
      path, source, ts.ScriptTarget.Latest, true, kind
    )
    assert.equal(file.parseDiagnostics.length, 0)
  })
}

// Compila os motores reais, preservando seus imports relativos.
// Não usa Supabase, navegador ou acesso à rede.
const modules = new Map()
for (const path of ['src/lib/financePace.ts', engineFile]) {
  const source = fs.readFileSync(path, 'utf8')
  modules.set(path, ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText)
}

const cache = new Map()
function load(path) {
  if (cache.has(path)) return cache.get(path)
  const exports = {}
  cache.set(path, exports)
  const requireLocal = spec => {
    assert.equal(spec, './financePace')
    return load('src/lib/financePace.ts')
  }
  new Function('exports', 'require', modules.get(path))(
    exports, requireLocal
  )
  return exports
}

const { buildMonthlyReview } = load(engineFile)

const ctx = 'dfl'
const today = '2026-10-24'
let seq = 0
const row = (date, type, amount, more = {}) => ({
  id: `id-${++seq}`,
  context: ctx,
  date,
  type,
  amount,
  status: 'done',
  affects_balance: true,
  account_id: 'a',
  category_id: 'food',
  ...more
})
const category = [{ id: 'food', name: 'Alimentação' }]
const calc = (rows, month = '2026-10', context = ctx, date = today) =>
  buildMonthlyReview(rows, category, context, month, date)

test('Receita realizada é reconhecida', () => {
  assert.equal(calc([row(today, 'income', 250)]).income, 250)
})
test('Receita pendente não é recebida', () => {
  const result = calc([row(today, 'income', 250, { status: 'pending' })])
  assert.equal(result.income, 0)
  assert.equal(result.pendingCount, 1)
})
test('Despesa realizada entra', () => {
  assert.equal(calc([row(today, 'expense', 80)]).expense, 80)
})
test('Compra no cartão entra uma vez', () => {
  const x = calc([
    row(today, 'expense', 90, {
      credit_card_id: 'card',
      status: 'pending'
    }),
    row(today, 'expense', 90, { invoice_id: 'invoice' })
  ])
  assert.equal(x.expense, 90)
  assert.equal(x.cardExpense, 90)
  assert.equal(x.cashExpense, 0)
})
test('Fatura sem duplicação', () => {
  assert.equal(calc([
    row(today, 'expense', 100, { invoice_id: 'invoice' })
  ]).expense, 0)
})
test('Transferência excluída', () => {
  assert.equal(calc([
    row(today, 'income', 300, { transfer_group_id: 'transfer' })
  ]).income, 0)
})
test('Financiamento e empréstimo excluídos', () => {
  assert.equal(calc([
    row(today, 'expense', 100, { financing_id: 'f' }),
    row(today, 'expense', 100, { loan_id: 'l' })
  ]).expense, 0)
})
test('Contexto pessoal não contamina empresa', () => {
  assert.equal(calc([
    row(today, 'income', 200, { context: 'personal' })
  ]).income, 0)
})
test('Contexto pessoal funciona isoladamente', () => {
  assert.equal(calc([
    row(today, 'income', 200, { context: 'personal' })
  ], '2026-10', 'personal').income, 200)
})
test('Mês aberto limita ao dia atual', () => {
  assert.equal(calc([
    row('2026-10-30', 'expense', 900)
  ]).expense, 0)
})
test('Mês anterior compara dias equivalentes', () => {
  const x = calc([
    row('2026-09-24', 'expense', 120),
    row('2026-09-25', 'expense', 400)
  ])
  assert.equal(x.comparableExpense, 120)
})
test('Mês fechado compara mês anterior completo', () => {
  const x = calc([
    row('2026-08-30', 'expense', 30),
    row('2026-09-15', 'expense', 50)
  ], '2026-09')
  assert.equal(x.comparableExpense, 30)
  assert.equal(x.expense, 50)
})
test('Seis meses cronológicos', () => {
  const x = calc([])
  assert.equal(x.history.length, 6)
  assert.equal(x.history[0].month, '2026-05')
  assert.equal(x.history[5].month, '2026-10')
})
test('Mudança de ano correta', () => {
  assert.equal(calc([], '2026-01', ctx, '2026-01-20')
    .history[0].month, '2025-08')
})
test('Categorias são classificadas', () => {
  const x = calc([row(today, 'expense', 75)])
  assert.equal(x.categories[0].name, 'Alimentação')
  assert.equal(x.categories[0].percent, 100)
})
test('Pendências não entram no resultado', () => {
  const x = calc([
    row(today, 'expense', 70, { status: 'pending' })
  ])
  assert.equal(x.expense, 0)
  assert.equal(x.pendingAmount, 70)
})
test('Importações aguardando conferência', () => {
  const x = calc([
    row(today, 'income', 120, {
      status: 'pending', source: 'whatsapp'
    })
  ])
  assert.equal(x.importsToReview, 1)
})
test('Lançamento sem categoria é sinalizado', () => {
  assert.equal(calc([
    row(today, 'expense', 10, { category_id: null })
  ]).missingCategories, 1)
})
test('Lançamento sem conta é sinalizado', () => {
  assert.equal(calc([
    row(today, 'expense', 10, { account_id: null })
  ]).missingAccounts, 1)
})
test('Datas impossíveis não entram', () => {
  assert.equal(calc([
    row('2026-02-30', 'expense', 20)
  ]).expense, 0)
})
test('Valores inválidos são ignorados', () => {
  assert.equal(calc([
    row(today, 'expense', NaN)
  ]).expense, 0)
})
test('Base zero não gera variação fictícia', () => {
  assert.equal(calc([
    row(today, 'expense', 100)
  ]).expenseVariation, null)
})
test('Não permite meses futuros', () => {
  assert.throws(() => calc([], '2026-11'))
})
test('Não modifica a entrada', () => {
  const rows = [row(today, 'expense', 24)]
  const before = JSON.stringify(rows)
  calc(rows)
  assert.equal(JSON.stringify(rows), before)
})
test('Motor sem operações de escrita', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|safeAdd|safeUpdate|localStorage/.test(engine))
})
test('Página sem operações de escrita', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|safeAdd|safeUpdate/.test(page))
})
test('Página usa contexto ativo', () => {
  assert.ok(page.includes('effectiveContext'))
  assert.ok(page.includes('<ContextToggle />'))
})
test('Navegação para conciliação e revisão', () => {
  assert.ok(page.includes("'/conciliation'"))
  assert.ok(page.includes("'/review'"))
})
test('Menu Mais aponta para V175', () => {
  const more = fs.readFileSync('src/app/(app)/more/page.tsx', 'utf8')
  assert.ok(fs.readFileSync('src/lib/financeIntelligenceNavigation.ts','utf8').includes('/monthly-review') && fs.readFileSync('src/app/(app)/more/page.tsx','utf8').includes('href="/intelligence-center"'))
})
test('V174 continua presente', () => {
  assert.ok(fs.existsSync('src/lib/financePressure.ts'))
  assert.ok(fs.existsSync('scripts/check-v174-finance-pressure.mjs'))
})
test('V173 continua presente', () => {
  assert.ok(fs.existsSync('src/lib/financePlanning.ts'))
})
test('V169 continua presente', () => {
  assert.ok(fs.existsSync('src/lib/financeReview.ts'))
})

console.log(`\nV175: ${checks} contratos aprovados.`)
