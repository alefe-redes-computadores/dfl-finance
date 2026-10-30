import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const source = fs.readFileSync('src/lib/smartFinancialInput.ts', 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
})
assert.equal((compiled.diagnostics || []).length, 0, 'Transpilacao do interpretador')
const module = { exports: {} }
new Function('module', 'exports', compiled.outputText)(module, module.exports)
const { interpretFinancialInput: parse, smartDraftUrl } = module.exports
const ref = new Date(2026, 9, 30, 12)

const spent = parse('paguei 286,40 no mercado ontem', ref)
assert.equal(spent?.type, 'expense')
assert.equal(spent.amount, 286.40)
assert.equal(spent.date, '2026-10-29')
assert.equal(spent.paid, true)
assert.equal(spent.description, 'mercado')
assert.equal(parse('paguei 20 e recebi 10', ref), null)
assert.equal(parse('recebi 1.500 da Maria hoje', ref)?.amount, 1500)
assert.equal(parse('recebi R$ 1.234,56', ref)?.amount, 1234.56)
assert.equal(parse('vou pagar 48 reais de gasolina amanha', ref)?.paid, false)
assert.equal(parse('paguei 50 de mercado 31/10/2026', ref)?.paid, false)
assert.equal(parse('paguei 50 de mercado 31/10/2026', ref)?.date, '2026-10-31')
assert.equal(parse('quanto gastei 286,40 em outubro', ref), null)
assert.equal(parse('pesquisar gasolina 48', ref), null)
assert.equal(parse('paguei sem informar valor', ref), null)
assert.equal(parse('paguei 0,00', ref), null)
assert.equal(parse('paguei 999999999,99', ref), null)
assert.equal(parse('paguei 20 em 31/02/2026', ref)?.date, '2026-10-30')
assert.ok(parse('paguei 20 em 31/02/2026', ref)?.warnings.some(x => x.includes('Data informada')))
const href = smartDraftUrl(spent)
assert.ok(href.startsWith('/transactions/new?'))
const params = new URL(href, 'https://finance.invalid').searchParams
assert.equal(params.get('intent'), 'smart')
assert.equal(params.get('amount'), '286.40')
assert.equal(params.get('paid'), '1')
assert.equal(params.get('date'), '2026-10-29')

const search = fs.readFileSync('src/app/(app)/search/page.tsx', 'utf8')
const home = fs.readFileSync('src/app/(app)/home/page.tsx', 'utf8')
const form = fs.readFileSync('src/app/(app)/transactions/new/page.tsx', 'utf8')
assert.ok(search.includes('interpretFinancialInput(trimmedQuery)'))
assert.ok(search.includes("recognition.lang = 'pt-BR'"))
assert.ok(search.includes('smartDraftUrl(smartDraft)'))
assert.ok(search.includes('Nao salvo'))
assert.ok(home.includes('aria-label="DFL Comando financeiro"'))
assert.ok(form.includes("searchParams.get('intent') !== 'smart'"))
assert.ok(form.includes('submitLockRef.current'))
for(const filename of [
  'src/app/(app)/search/page.tsx',
  'src/app/(app)/home/page.tsx',
  'src/app/(app)/transactions/new/page.tsx',
]) {
  const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  assert.equal(ast.parseDiagnostics.length, 0, `Sintaxe TSX: ${filename}`)
}
console.log('R411: 26 verificacoes de interpretacao, estado seguro, navegacao, voz e sintaxe aprovadas')
