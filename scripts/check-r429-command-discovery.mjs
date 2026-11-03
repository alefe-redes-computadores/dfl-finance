import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = f => fs.readFileSync(f, 'utf8')
let checks = 0
const eq = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks++ }
const yes = (label, value) => { assert.ok(value, label); checks++ }

const path = 'src/lib/financialIntentExpansion.ts'
const source = read(path)
const syntax = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
eq('Motor: sintaxe TypeScript', syntax.parseDiagnostics.length, 0)
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 }, reportDiagnostics: true })
eq('Motor: sem erros de transpilacao', (js.diagnostics || []).length, 0)
const exports = {}
new Function('exports', js.outputText)(exports)
const { resolveExtendedFinancialCommands: command, suggestFinancialRecovery: recovery, financialStarterExamples: starters } = exports

for (const [text, id, href] of [
  ['novo cartão','new-card','/cards/new'],
  ['Novo cartão','new-card','/cards/new'],
  ['NOVO CARTÃO','new-card','/cards/new'],
  ['  cadastrar  um  cartão ','new-card','/cards/new'],
  ['quero criar um cartão de crédito','new-card','/cards/new'],
  ['preciso cadastrar uma conta bancária','new-account','/accounts/new'],
  ['nova conta','new-account','/accounts/new'],
  ['cadastrar conta digital','new-account','/accounts/new'],
  ['criar meta','new-goal','/goals/new'],
  ['nova meta financeira','new-goal','/goals/new'],
  ['criar orçamento mensal','new-budget','/budgets/new'],
  ['adicionar contato','new-contact','/contacts/new'],
  ['novo cliente','new-contact','/contacts/new'],
  ['cadastrar fornecedor','new-contact','/contacts/new'],
  ['nova assinatura','new-subscription','/subscriptions/new'],
  ['cadastrar despesa recorrente','new-subscription','/subscriptions/new'],
  ['novo empréstimo','new-loan','/loans/new'],
  ['registrar financiamento','new-financing','/financings/new'],
  ['novo valor a receber','new-receivable','/debts/new'],
  ['adicionar um novo cartão','new-card','/cards/new'],
  ['montar orçamento','new-budget','/budgets/new'],
  ['nova categoria','manage-category','/categories'],
  ['crie uma meta','new-goal','/goals/new'],
  ['cadastre um cartão','new-card','/cards/new'],
]) {
  const found = command(text)
  eq(`Intent ${text}: ID`, found[0]?.id, id)
  eq(`Intent ${text}: rota`, found[0]?.href, href)
  eq(`Intent ${text}: exige revisao`, found[0]?.intent, 'create')
}
for (const q of [
  'despesas do cartão Nubank', 'ver cartão Nubank', 'cartão Nubank',
  'novo cartão Nubank', 'novo cartão do Nubank', 'fatura novembro',
  'quanto gastei no cartão', 'excluir cartão', 'apagar cartão',
  'transferir dinheiro para Pedro', 'paguei 48 de gasolina',
  'criar despesa de gasolina 48', 'abrir cartões', 'cartões do Nubank',
  'nova despesa de mercado', 'nova receita 200', 'criar conta do Nubank',
  'contas e cartões', 'cancelar assinatura Netflix',
]) eq(`Nao confunde consulta/acao com cadastro: ${q}`, command(q).length, 0)

for (const [q, ids] of [
  ['cartão estranho',['view-cards','new-card','view-receipts']],
  ['fatura',['view-cards','new-card','view-receipts']],
  ['conta bancária',['view-accounts','new-account','view-transactions']],
  ['meta',['view-goals','new-goal','view-planning']],
  ['orçamento',['view-budgets','new-budget','view-analysis']],
  ['assinaturas',['view-subscriptions','new-subscription','view-transactions']],
  ['empréstimos',['view-loans','new-loan','view-planning']],
  ['comprovantes',['view-receipts','view-transactions','view-cards']],
  ['despesas',['view-transactions','new-expense','view-categories']],
  ['receitas',['view-transactions','new-income','view-accounts']],
]) eq(`Recuperacao contextual: ${q}`, recovery(q).map(item => item.id), ids)
for (const scope of ['home','transactions','analysis','cards','search']) {
  const first = starters(scope,0)
  const second = starters(scope,3)
  eq(`Exemplos no escopo ${scope}: 3`, first.length, 3)
  yes(`Exemplos variados no escopo ${scope}`, first.every(t => !second.includes(t)))
  yes(`Exemplos de ${scope}: sem repeticoes`, new Set([...first,...second]).size === 6)
  yes(`Fallback ${scope}: tem ao menos 3 rotas`, recovery('xyz sem correspondencia',scope).length===3)
}
for (const item of recovery('xyz sem correspondencia','search')) yes(`Rota interna ${item.id}`, /^\/(?!\/)/.test(item.href))
for (const route of [
  'cards/new','accounts/new','goals/new','budgets/new','contacts/new','subscriptions/new',
  'loans/new','financings/new','debts/new','cards','accounts','budgets','goals',
  'loans','financings','subscriptions','contacts','debts','transactions','receipts','planning','analysis','categories',
]) yes(`Rota real /${route}`, fs.existsSync(`src/app/(app)/${route}/page.tsx`))
yes('Motor sem IO, banco ou escrita', !/\b(fetch|localStorage|sessionStorage|indexedDB|db\.|supabase|router\.|\.put\(|\.add\()/.test(source))
yes('Catalogo apenas rotas internas', !/https?:\/\//.test(source))
for (const p of ['src/app/(app)/search/page.tsx','src/components/ContextualCommandBar.tsx','src/lib/contextualCommand.ts']) {
  const kind = p.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const ast = ts.createSourceFile(p, read(p), ts.ScriptTarget.Latest, true, kind)
  eq(`Sintaxe da integracao ${p}`, ast.parseDiagnostics.length, 0)
}
const search = read('src/app/(app)/search/page.tsx')
const bar = read('src/components/ContextualCommandBar.tsx')
const config = read('src/lib/contextualCommand.ts')
const workflow = read('.github/workflows/android-build.yml')
for(const [label, pass] of [
  ['Busca inclui novos comandos',search.includes('resolveExtendedFinancialCommands(trimmedQuery)')],
  ['Busca evita consulta para cadastro',search.includes('extendedCommands.length > 0')],
  ['Busca mantem motor R428',search.includes('isFinancialCommandOnlyQuery(trimmedQuery, commands.map(command => command.id))')],
  ['Busca mantem R424 e identidade de usuario',search.includes("if (searchPhase !== 'ready') return []")],
  ['Busca mantém rascunho seguro',search.includes('smartDraftUrl(smartDraft)')],
  ['Busca mantém navegação segura',search.includes('resolveFinancialNavigationIntent(trimmedQuery)')],
  ['Busca tem painel de recuperacao',search.includes('Caminhos que podem ajudar')],
  ['Busca distingue filtro de zero registros',search.includes('Existem resultados na consulta, mas nenhum com os filtros atuais.')],
  ['Busca nao confunde sugestoes com achados',search.includes('Sugestões de navegação, não resultados encontrados')],
  ['Busca nao navega automaticamente',search.includes('onClick={() => { vibrate([8]); router.push(action.href) }}')],
  ['Busca alterna exemplos por sessao',search.includes('dfl.finance.command.starters.r429:')],
  ['Busca mantém guia R427',search.includes('buildFinancialResultGuidance(items, resultFacets')],
  ['Barra alterna exemplos a cada reabertura',bar.includes('dfl.finance.command.examples.r429:')],
  ['Barra oferece troca manual',bar.includes('Mostrar outro exemplo do DFL Comando')],
  ['Barra respeita reducao de movimento',bar.includes("prefers-reduced-motion: reduce")],
  ['Barra respeita page visibility',bar.includes('pageActive')],
  ['Exemplos por area: pool de 12',config.includes('Novo cartão') && config.includes('Novo financiamento')],
  ['CI executa verificacoes R429',workflow.includes('node scripts/check-r429-command-discovery.mjs')],
  ['CI preserva R428',workflow.includes('node scripts/check-r428-premium-closure.mjs')],
]) yes(label,pass)
console.log(`R429: ${checks} contratos de comandos, seguranca, recuperacao, exemplos, sintaxe e CI aprovados`)
