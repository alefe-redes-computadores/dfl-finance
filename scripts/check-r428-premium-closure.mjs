import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')
let checks = 0
const yes = (label, value) => { assert.ok(value, label); checks++ }
const eq = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks++ }
const helperPath = 'src/lib/financialCommandOnly.ts'
const source = read(helperPath)
const helperCode = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS } }).outputText
const helperExports = {}
new Function('exports', helperCode)(helperExports)
const { isFinancialCommandOnlyQuery: only } = helperExports
const cases = [
  ['nova despesa', 'new-expense', true],
  ['criar despesa', 'new-expense', true],
  ['adicionar despesa', 'new-expense', true],
  ['registrar despesa', 'new-expense', true],
  ['nova receita', 'new-income', true],
  ['criar receita', 'new-income', true],
  ['adicionar receita', 'new-income', true],
  ['registrar receita', 'new-income', true],
  ['transferir entre contas', 'transfer', true],
  ['abrir conciliação', 'inbox', true],
  ['abrir planejamento', 'planning', true],
  ['ver comprovantes', 'receipts', true],
  ['NOVa RECEITA', 'new-income', true],
  ['  nova  despesa  ', 'new-expense', true],
  ['nova despesa de mercado', 'new-expense', false],
  ['ver despesas do Nubank', 'new-expense', false],
  ['nova receita 45', 'new-income', false],
  ['transferir dinheiro para Ana', 'transfer', false],
  ['abrir cartões', 'new-income', false],
  ['paguei 48 gasolina', 'new-expense', false],
  ['nova despesa', 'transfer', false],
  ['', 'new-expense', false],
  ['ver comprovantes do Nubank', 'receipts', false],
]
for (const [query, id, expected] of cases) eq(`Comando puro: ${query}`, only(query, [id]), expected)
eq('Não confia em ID não reconhecido', only('nova despesa', []), false)
yes('Não depende de IndexedDB ou de rede', !/fetch\(|supabase|indexedDB|localStorage|sessionStorage|\.put\(|\.add\(/.test(source))
yes('Não usa spread de Set incompatível com ES5', !source.includes('[...new Set('))

const page = read('src/app/(app)/search/page.tsx')
const orb = read('src/components/FinanceVoiceOrb.tsx')
const hub = read('src/components/FinancialCommandHub.tsx')
const guide = read('src/components/FinancialResultGuide.tsx')
const ci = read('.github/workflows/android-build.yml')
for (const path of [helperPath,'src/app/(app)/search/page.tsx','src/components/FinanceVoiceOrb.tsx',
  'src/components/FinancialCommandHub.tsx','src/components/FinancialResultGuide.tsx']) {
  const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  eq('Sintaxe TypeScript válida: '+path, ast.parseDiagnostics.length, 0)
}
for (const [label, condition] of [
  ['Comandos exatos usam reconhecedor compartilhado',page.includes('isFinancialCommandOnlyQuery(trimmedQuery, commands.map(command => command.id))')],
  ['Sem leitura local para comandos puros',page.includes('navigationIntent || commandOnly) {')],
  ['Busca reexecuta ao sair do modo comando',page.includes('navigationIntent, commandOnly])')],
  ['Comando puro não exibe nenhum resultado falso',page.includes('navigationIntent || commandOnly || !trimmedQuery ? null')],
  ['Leitor de tela reconhece comando pronto',page.includes("commandOnly ? 'Ação pronta para abrir após confirmação'")],
  ['Feedback da voz cessa ao digitar',page.includes('setQuery(event.target.value); setHubVoiceEntry(false)')],
  ['Limpar busca encerra estado de entrada por voz',page.includes("setQuery('')\n    setHubVoiceEntry(false)")],
  ['Filtro abre com teclado recolhido',page.includes('inputRef.current?.blur()\n                setFiltersOpen(true)')],
  ['Modal de filtros tem papel acessível',page.includes('role="dialog" aria-modal="true" aria-label="Filtros da busca financeira"')],
  ['Modal respeita safe area',page.includes('pb-[calc(12px+var(--safe-area-bottom))]')],
  ['Busca apresenta contexto atual',page.includes("{context === 'dfl' ? 'Empresa' : 'Pessoal'}")],
  ['Voz fecha por Escape',orb.includes("event.key === 'Escape'") && orb.includes("document.addEventListener('keydown', onEscape)")],
  ['Voz limitada à viewport',orb.includes('max-h-[80dvh]') && orb.includes('overflow-y-auto')],
  ['Voz segue mesmo nome DFL Comando',orb.includes(' /> DFL Comando')],
  ['Central segue mesmo nome DFL Comando',hub.includes('>DFL Comando</h2>')],
  ['Central mantém favoritos',hub.includes('toggleHubFavorite(') && hub.includes('rememberHubAction(')],
  ['Guia mantém ação por toque explícito',guide.includes("guidance.kind === 'refine' ? onRefine(guidance.facet) : onOpen(guidance.item)")],
  ['Guia preserva dark premium',guide.includes('dark:bg-slate-900/75') && guide.includes('motion-safe:duration-200')],
  ['R411: rascunho continua com revisão',page.includes('smartDraftUrl(smartDraft)')],
  ['R418: navegação determinística preservada',page.includes('resolveFinancialNavigationIntent(trimmedQuery)')],
  ['R424: isolamento de contexto preservado',page.includes("if (searchPhase !== 'ready') return []")],
  ['R426: filtros vivos preservados',page.includes('buildFinancialSearchFacets(items)')],
  ['R427: sugestão contextual preservada',page.includes('buildFinancialResultGuidance(items, resultFacets')],
  ['Bot não ativado no patch',!page.includes('supabase') && !orb.includes('supabase') && !hub.includes('supabase')],
  ['CI integra R428',ci.includes('node scripts/check-r428-premium-closure.mjs')],
  ['CI faz typecheck e lint',ci.includes('npm run typecheck') && ci.includes('npm run lint')],
  ['Botão + continua formulário completo',read('src/components/BottomNav.tsx').includes("navigateSafely('/transactions/new')")],
]) yes(label, condition)
for (const version of ['411','412','417','418','419','420','421','422','423','424','425','426','427'])
  yes(`Regressão R${version} continua no Android`,ci.includes(`node scripts/check-r${version}-`))
yes('Homologação documentada',read('docs/r428-homologacao-apk.md').includes('## Testes no APK'))
console.log(`R428: ${checks} verificações de fechamento premium, comandos, voz, navegação, privacidade e CI aprovadas.`)
