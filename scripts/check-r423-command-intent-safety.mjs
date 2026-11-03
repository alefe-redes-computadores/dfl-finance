import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = p => fs.readFileSync(p, 'utf8')
function evaluate(file, importer = () => { throw Error('Import inesperado') }) {
  const src = read(file)
  const ast = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  assert.equal(ast.parseDiagnostics.length, 0, 'TS: ' + file)
  const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  new Function('require', 'exports', js)(importer, exports)
  return exports
}
const globalSearch = evaluate('src/lib/globalSearch.ts', name => {
  if (name === '@/lib/db') return { db: {} }
  if (name === '@/lib/financialForecast') return { civilDate: () => true }
  throw Error('GlobalSearch importa modulo inesperado ' + name)
})
const smart = evaluate('src/lib/smartFinancialInput.ts')
const nav = evaluate('src/lib/financialNavigationIntent.ts', name => {
  if (name === '@/lib/globalSearch') return globalSearch
  if (name === '@/lib/smartFinancialInput') return smart
  throw Error('Intent importa modulo inesperado ' + name)
})
const reference = new Date(2026, 10, 3, 12)
let checks = 0
function test(input, expected) {
  const actual = nav.resolveFinancialNavigationIntent(input, reference)?.href ?? null
  assert.equal(actual, expected, `Comando divergente: ${input}`)
  checks++
}
for (const [input, expected] of [
  ['abrir cartões', '/cards'],
  ['abrir meu cartão', '/cards'],
  ['abrir faturas', '/cards'],
  ['ir para contas', '/accounts'],
  ['ir para as contas bancárias', '/accounts'],
  ['mostrar análises financeiras', '/analysis'],
  ['ver minhas pendências', '/conciliation'],
  ['ver assinaturas', '/subscriptions'],
  ['abrir relatórios', '/reports'],
  ['abrir planejamento', '/planning'],
  ['ver metas', '/goals'],
  ['abrir extrato', '/transactions?filter=all'],
  ['abrir extrato em abril de 2024', '/transactions?filter=all&month=2024-04'],
  ['mostrar despesas de novembro de 2026', '/transactions?filter=expense&month=2026-11'],
  ['abrir cartões do Nubank', null],
  ['abrir cartão do Inter', null],
  ['ver faturas do Nubank', null],
  ['abrir contas do Inter', null],
  ['abrir contas pessoais', null],
  ['abrir relatórios de novembro', null],
  ['abrir análises de 2025', null],
  ['ver metas da empresa', null],
  ['mostrar agenda de hoje', null],
  ['abrir cartão e metas', null],
  ['ver contas do mês', null],
  ['paguei 48 reais de gasolina ontem', null],
  ['transferir entre contas', null],
  ['ver despesas do Nubank', null],
]) test(input, expected)

const navCode=read('src/lib/financialNavigationIntent.ts')
const speech=read('src/hooks/useFinancialSpeech.ts')
const bar=read('src/components/ContextualCommandBar.tsx')
const card=read('src/components/ContextualInsightCard.tsx')
const search=read('src/app/(app)/search/page.tsx')
const ci=read('.github/workflows/android-build.yml')
function ok(label, test) { assert.ok(test, label); checks++ }
for (const file of ['src/hooks/useFinancialSpeech.ts','src/components/ContextualCommandBar.tsx','src/components/ContextualInsightCard.tsx','src/app/(app)/search/page.tsx']) {
  const parsed=ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  ok('Sintaxe: '+file, parsed.parseDiagnostics.length===0)
}
ok('Qualificadores de menu nao ignorados',navCode.includes('if (leftover) return null'))
ok('Sem gravacoes ou banco no roteador',!navCode.includes('fetch(')&&!navCode.includes('supabase')&&!navCode.includes('db.transactions'))
ok('Cancelamento invalida a transcricao',/setStatus\('idle'\)[\s\S]*?setNotice\(''\)[\s\S]*?setTranscript\(''\)/.test(speech))
ok('Motor nativo reaproveitado',speech.includes("@capacitor-community/speech-recognition"))
ok('Texto nao compete com escuta',bar.includes("voiceStatus === 'listening' || voiceStatus === 'processing'"))
ok('Barra conserva voz de um toque',bar.includes('void startVoice()')&&bar.includes('stageFinancialVoiceTranscript(voiceTranscript)'))
ok('Protecao visual de chave ativa',card.includes('{preparing && !activeVisible ? ('))
ok('Insight continua isolado por contexto',card.includes('visible?.key === key')&&card.includes('planContextualInsight({'))
ok('Foco do teclado acompanhado',search.includes('setInputFocused(true)')&&search.includes('setInputFocused(false)'))
ok('Atalhos nao ficam sob o teclado',search.includes('!trimmedQuery && !inputFocused && ('))
ok('Abertura contextual preserva atalhos',search.includes('} else if (commandSource) {'))
ok('Abertura direta preserva foco',search.includes('inputRef.current?.focus()'))
ok('R411 previa nao muda',search.includes('smartDraftUrl(smartDraft)'))
ok('R418 permanece',search.includes('resolveFinancialNavigationIntent(trimmedQuery)'))
ok('R420 permanece',search.includes('<FinancialCommandHub'))
ok('R423 CI',ci.includes('node scripts/check-r423-command-intent-safety.mjs'))
for(const v of ['417','418','419','420','421','422'])ok('Regressao CI R'+v,ci.includes('node scripts/check-r'+v+'-'))
console.log(`R423: ${checks} contratos de intent, voz, teclado, insight, privacidade e CI aprovados.`)
