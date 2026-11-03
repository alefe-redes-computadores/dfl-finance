import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = f => fs.readFileSync(f, 'utf8')
function evaluate(file, importer = () => { throw Error('Unexpected test import') }) {
  const src = read(file)
  const tree = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.equal(tree.parseDiagnostics.length, 0, `TS syntax: ${file}`)
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const exp = {}
  new Function('require', 'exports', js)(importer, exp)
  return exp
}
const globalSearch = evaluate('src/lib/globalSearch.ts', name => {
  if (name === '@/lib/db') return { db: {} }
  if (name === '@/lib/financialForecast') return { civilDate: () => true }
  throw Error('Unexpected global search import ' + name)
})
const financialDraft = evaluate('src/lib/smartFinancialInput.ts')
const intent = evaluate('src/lib/financialNavigationIntent.ts', name => {
  if (name === '@/lib/globalSearch') return globalSearch
  if (name === '@/lib/smartFinancialInput') return financialDraft
  throw Error('Unexpected intent import ' + name)
})
const at = new Date(2026, 10, 3, 12)
const nav = text => intent.resolveFinancialNavigationIntent(text, at)
let count = 0
function test(text, expected) {
  const got = nav(text)
  assert.equal(got?.href ?? null, expected, `Unexpected intent for ${text}`)
  if (got) {
    assert.ok(got.href.startsWith('/') && !got.href.startsWith('//'), 'Local route only')
    assert.ok(!got.href.includes('javascript:'), 'No executable route')
  }
  count++
}
for (const [query, href] of [
  ['abrir cartões', '/cards'],
  ['ir para contas', '/accounts'],
  ['mostrar análises', '/analysis'],
  ['abrir conciliação', '/conciliation'],
  ['ver minhas pendências', '/conciliation'],
  ['abrir relatórios', '/reports'],
  ['ver assinaturas', '/subscriptions'],
  ['abrir metas', '/goals'],
  ['abrir categorias', '/categories'],
  ['acessar comprovantes', '/receipts'],
  ['mostrar despesas de novembro de 2026', '/transactions?filter=expense&month=2026-11'],
  ['ver receitas outubro', '/transactions?filter=income&month=2026-10'],
  ['abrir extrato', '/transactions?filter=all'],
  ['abrir transações', '/transactions?filter=all'],
  ['acessar extrato', '/transactions?filter=all'],
  ['abrir extrato de novembro', '/transactions?filter=all&month=2026-11'],
  ['abrir extrato em abril de 2024', '/transactions?filter=all&month=2024-04'],
  ['abrir extrato em 11/26', '/transactions?filter=all&month=2026-11'],
  ['ir para transações', '/transactions?filter=all'],
  ['ver transferências', '/transactions?filter=transfer'],
  ['mostrar gastos em fevereiro de 2024', '/transactions?filter=expense&month=2024-02'],
  ['ver despesas do mês', '/transactions?filter=expense'],
  ['quanto gastei em outubro?', null],
  ['paguei 48 reais de gasolina ontem', null],
  ['transferir entre contas', null],
  ['mostrar gastos com combustível em novembro', null],
  ['ver despesas do Inter', null],
  ['ver transações de 2026', null],
  ['mostrar despesas ontem', null],
  ['abrir cartões e contas', null],
  ['excluir contas', null],
  ['abrir https://example.com', null],
  ['Nubank', null],
]) test(query, href)
assert.equal(intent.isAllowedFinancialMonth('2026-11'), true)
assert.equal(intent.isAllowedFinancialMonth('2026-13'), false)
assert.equal(intent.isAllowedFinancialMonth('hello'), false)
count += 3
const search = read('src/app/(app)/search/page.tsx')
const transactions = read('src/app/(app)/transactions/page.tsx')
const ci = read('.github/workflows/android-build.yml')
assert.ok(search.includes('resolveFinancialNavigationIntent(trimmedQuery)'), 'Search interprets navigation')
assert.ok(search.includes('navigationIntent.href'), 'Explicit user click opens navigation')
assert.ok(search.includes('consumeFinancialVoiceTranscript()'), 'Speech remains connected')
assert.ok(search.includes('interpretFinancialInput(trimmedQuery)'), 'Safe draft remains connected')
assert.ok(transactions.includes("searchParams.get('month')"), 'Month URL applied')
assert.ok(transactions.includes('isAllowedFinancialMonth('), 'Month URL validated')
assert.ok(transactions.includes("searchParams.get('filter')"), 'Filter URL preserved')
assert.ok(read('src/components/BottomNav.tsx').includes("navigateSafely('/transactions/new')"), 'Plus remains complete form')
assert.ok(ci.includes('node scripts/check-r418-financial-navigation.mjs'), 'CI includes R418')
for (const p of ['src/app/(app)/search/page.tsx', 'src/app/(app)/transactions/page.tsx']) {
  const source = ts.createSourceFile(p, read(p), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  assert.equal(source.parseDiagnostics.length, 0, p + ' TSX syntax')
}
console.log(`R418: ${count} casos de intenção/segurança e 11 contratos de integração aprovados; sem gravações financeiras.`)
