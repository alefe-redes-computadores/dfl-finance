import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = f => fs.readFileSync(f, 'utf8')
const path = 'src/lib/globalSearch.ts'
const source = read(path)
const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
assert.equal(ast.parseDiagnostics.length, 0, 'R425: fonte da busca sem erro de sintaxe')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS }
})
const user = '12345678-1234-1234-1234-123456789abc'
const dataset = {
  transactions: [
    { id: 't-1', user_id: user, context: 'dfl', type: 'expense', date: '2026-11-02', amount: 48, description: 'Gasolina', account_id: 'a-1' },
    { id: 't-2', user_id: user, context: 'personal', type: 'expense', date: '2026-11-02', amount: 72, description: 'Mercado', account_id: 'a-2' }
  ],
  accounts: [
    { id: 'a-1', user_id: user, context: 'dfl', name: 'Nubank' },
    { id: 'a-2', user_id: user, context: 'personal', name: 'Inter' }
  ],
  credit_cards: [
    { id: 'c-1', user_id: user, context: 'dfl', name: 'Nubank' },
    { id: 'c-2', user_id: user, context: 'personal', name: 'Inter' }
  ],
  debts: [], loans: [], financings: [], subscriptions: [], goals: [], categories: [], contacts: []
}
const db = Object.fromEntries(Object.entries(dataset).map(([name, rows]) => [name, {
  where(index) {
    assert.equal(index, '[user_id+context]', 'Consulta deve preservar indice contexto/usuario')
    return { equals([uid, context]) {
      return { async toArray() {
        return rows.filter(item => item.user_id === uid && item.context === context)
      } }
    } }
  }
}]))
const exports = {}
new Function('require', 'exports', compiled.outputText)(name => {
  if (name === '@/lib/db') return { db }
  if (name === '@/lib/financialForecast') return { civilDate: value => /^20\d{2}-\d{2}-\d{2}$/.test(String(value)) }
  throw Error('R425: dependencia nao prevista: ' + name)
}, exports)
const { parseDateIntent: parse, searchFinancialData: search } = exports
const reference = new Date(2026, 10, 3, 12)
let count = 0
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, label)
  count++
}
function month(text, expected) {
  check('Mes interpretado: ' + text, parse(text, reference)?.start.slice(0, 7) ?? null, expected)
}
for (const query of [
  'abrir cartões', 'abrir cartão do Nubank', 'ver maior despesa',
  'maior', 'junto', 'julgo', 'procurar em contas', 'Nubank',
  'abriil', 'maiio', 'junhp', 'abriu'
]) month(query, null)
for (const [query, expected] of [
  ['abril', '2026-04'], ['abr', '2026-04'], ['maio?', '2026-05'],
  ['em abriil', '2026-04'], ['em maiio', '2026-05'],
  ['em junhp', '2026-06'], ['em julhp', '2026-07'],
  ['abrio/26', '2026-04'], ['mai/26', '2026-05'],
  ['novemvro', '2026-11'], ['setemvro?', '2026-09'],
  ['novembro de 2024', '2024-11'], ['11/26', '2026-11'],
  ['fevereiro', '2026-02'], ['outubro?', '2026-10']
]) month(query, expected)
check('Nao perde fim do mes', parse('abril', reference)?.end, '2026-04-30')
check('Ano completo preservado', [parse('2025', reference)?.start, parse('2025', reference)?.end], ['2025-01-01', '2025-12-31'])
check('Hoje preservado', parse('hoje', reference)?.start, '2026-11-03')
check('Ontem preservado', parse('ontem', reference)?.start, '2026-11-02')

const business = await search(user, 'dfl', 'abrir cartões do Nubank')
check('Busca entidades qualificadas', business.some(x => x.id === 'c-1' && x.kind === 'card'), true)
check('Busca banco sem mes fantasma', business.some(x => x.id === 'a-1' && x.kind === 'account'), true)
check('Busca despesa da conta', (await search(user, 'dfl', 'ver despesas do Nubank')).some(x => x.id === 't-1'), true)
check('Busca com por favor', (await search(user, 'dfl', 'por favor abrir cartões do Nubank')).some(x => x.id === 'c-1'), true)
check('Busca direta preservada', (await search(user, 'dfl', 'Nubank')).some(x => x.id === 'c-1'), true)
check('Ponto final no comando nao esconde entidade', (await search(user, 'dfl', 'abrir cartões do Nubank.')).some(x => x.id === 'c-1'), true)
check('Interrogacao no comando nao esconde entidade', (await search(user, 'dfl', 'abrir cartões do Nubank?')).some(x => x.id === 'c-1'), true)
check('Mes com interrogacao encontra lancamento real', (await search(user, 'dfl', 'novembro?')).some(x => x.id === 't-1'), true)
check('Mes com erro e interrogacao encontra lancamento real', (await search(user, 'dfl', 'novemvro?')).some(x => x.id === 't-1'), true)
check('Consulta de cartão pessoal', (await search(user, 'personal', 'buscar cartão do Inter')).some(x => x.id === 'c-2'), true)
check('Empresa nao vaza no Pessoal', (await search(user, 'personal', 'abrir cartões do Nubank')).length, 0)
check('Pessoal nao vaza na Empresa', (await search(user, 'dfl', 'buscar cartão do Inter')).length, 0)
check('Usuario diferente nao acessa dados', (await search('unknown-user', 'dfl', 'Nubank')).length, 0)
check('Sem registros para frase vazia', (await search(user, 'dfl', ' ')).length, 0)

const ci = read('.github/workflows/android-build.yml')
check('CI inclui contrato R425', ci.includes('node scripts/check-r425-search-month-language.mjs'), true)
for (const v of ['417','418','419','420','421','422','423','424']) {
  check('CI conserva gate R'+v, ci.includes('node scripts/check-r'+v+'-'), true)
}
check('Nao acrescentou escrita remota', !source.includes('supabase') && !source.includes('fetch('), true)
check('Nao criou outro motor IA', !source.includes('openai') && !source.includes('anthropic'), true)
check('Regra de linguagem legivel', source.includes('NON_MONTH_WORDS') && source.includes('LOOKUP_ACTION'), true)
console.log(`R425: ${count} contratos aprovados — meses, typos, qualificadores, contexto PF/PJ e CI`)
