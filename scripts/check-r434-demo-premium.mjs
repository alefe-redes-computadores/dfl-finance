import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = p => fs.readFileSync(p, 'utf8')
let checks=0
const eq=(label,a,b)=>{assert.deepEqual(a,b,label);checks++}
const yes=(label,b)=>{assert.ok(b,label);checks++}
const path='src/lib/financialDemoIntents.ts'
const source=read(path)
const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
eq('R434 sintaxe TypeScript',ast.parseDiagnostics.length,0)
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES5},reportDiagnostics:true})
eq('R434 motor compila com target ES5',compiled.diagnostics?.length??0,0)
const exports={}
new Function('exports',compiled.outputText)(exports)
const {resolveFinancialDemoIntent:demo,FINANCIAL_DEMO_SAMPLES:samples}=exports
for(const [phrase,id,href] of [
 ['novo cartão Nubank','new-card','/cards/new'],
 ['Novo cartão do Nubank','new-card','/cards/new'],
 ['quero cadastrar meu cartão Nubank','new-card','/cards/new'],
 ['cadastrar cartão Inter','new-card','/cards/new'],
 ['criar cartão do Banco do Brasil','new-card','/cards/new'],
 ['me ajuda a cadastrar um cartão Inter','new-card','/cards/new'],
 ['poderia criar um novo cartão do banco','new-card','/cards/new'],
 ['cadastrar uma conta do Nubank','new-account','/accounts/new'],
 ['quero cadastrar uma conta digital no Inter','new-account','/accounts/new'],
 ['registrar conta bancaria do Brasil','new-account','/accounts/new'],
 ['cadastrar novo cliente João','new-contact','/contacts/new'],
 ['novo fornecedor Pedro','new-contact','/contacts/new'],
 ['registrar contato da Maria','new-contact','/contacts/new'],
 ['nova assinatura Netflix','new-subscription','/subscriptions/new'],
 ['cadastrar assinatura do Spotify','new-subscription','/subscriptions/new'],
 ['criar meta para viagem','new-goal','/goals/new'],
 ['nova meta de economia para casa','new-goal','/goals/new'],
 ['criar um orçamento para novembro','new-budget','/budgets/new'],
 ['montar orçamento mensal da casa','new-budget','/budgets/new'],
 ['criar limite de gastos para mercado','new-budget','/budgets/new'],
 ['registrar financiamento de carro','new-financing','/financings/new'],
 ['novo financiamento da moto','new-financing','/financings/new'],
 ['cadastrar empréstimo do banco','new-loan','/loans/new'],
 ['novo empréstimo da Ana','new-loan','/loans/new'],
 ['registrar dívida a receber da Ana','new-receivable','/debts/new'],
 ['nova conta a receber do cliente','new-receivable','/debts/new'],
 ['adicionar categoria de despesa','manage-category','/categories'],
 ['criar uma categoria de receita','manage-category','/categories'],
]) {
 const c=demo(phrase)
 eq(`Intencao ${phrase}`,c?.id,id)
 eq(`Rota ${phrase}`,c?.href,href)
 eq(`Revisao ${phrase}`,c?.intent,'create')
 yes(`Nao gravar ${phrase}`,/Nenhum cadastro é salvo agora/.test(c?.description??''))
}
for(const phrase of [
 'ver cartão Nubank','cartão Nubank','quanto gastei no cartão Nubank',
 'mostrar fatura Nubank','fatura em aberto','abrir cartões',
 'excluir cartão Nubank','pagar cartão Nubank','transferir 500',
 'quero cadastrar cartão e conta','novo cartão e financiamento',
 'criar uma receita de 200','nova despesa','paguei combustível',
 'quero cancelar assinatura','quanto recebi em outubro',
 'criar cartão e excluir outro','cadastrar um cartão e um financiamento',
 'comparar gastos do cartão', 'criar meta e orçamento',
 'quero ver contas do Nubank', 'nova conta e novos cartões',
]) eq(`Nao sequestra consulta/operacao ${phrase}`,demo(phrase),null)
eq('Exemplos demo sao 8',samples.length,8)
for(const href of ['/cards/new','/accounts/new','/contacts/new','/subscriptions/new','/goals/new','/budgets/new','/financings/new','/loans/new','/debts/new','/categories']) {
 const route=href.slice(1)
 yes(`Rota existe ${href}`,fs.existsSync(`src/app/(app)/${route}/page.tsx`))
}
for(const p of ['src/app/(app)/search/page.tsx','src/lib/financialIntentExpansion.ts','src/lib/financialDemoIntents.ts']) {
 const src=read(p);const syntax=ts.createSourceFile(p,src,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
 eq('Sintaxe mantida '+p,syntax.parseDiagnostics.length,0)
}
const screen=read('src/app/(app)/search/page.tsx')
const engine=read('src/lib/financialIntentExpansion.ts')
const workflow=read('.github/workflows/android-build.yml')
const current=read('src/lib/financialScopedQuestions.ts')
const chat=read('src/app/(app)/assistant/chat/page.tsx')
const gate=[
 ['R429 preservado',screen.includes('resolveExtendedFinancialCommands(trimmedQuery)')],
 ['R430 preservado',screen.includes('interpretFinancialReadOnlyQuestion(trimmedQuery)')],
 ['R431 preservado',screen.includes('resolveFinancialHelp(trimmedQuery)')],
 ['R432 preservado',screen.includes('interpretFinancialQuestion360(trimmedQuery)')],
 ['R433 preservado',screen.includes('interpretScopedFinancialQuestion(trimmedQuery)')],
 ['R434 integra fallback conservador',screen.includes('resolveFinancialDemoIntent(trimmedQuery)')],
 ['Fallback nao compete com motores de consulta',screen.includes('smartDraft || navigationIntent || scopedIntent || readOnlyIntent || question360 || !trimmedQuery')],
 ['Nao mostra vazio para comando',screen.includes('|| !!demoIntent')],
 ['Cmd existente permanece prioritario',screen.includes('...(demoIntent ? [demoIntent] : [])')],
 ['Primeiro teste inclui Novo Cartao',engine.includes("search: ['Novo cartão', 'Nova despesa', 'Ver cartões'")],
 ['R433 ambas as sugestoes preservadas',engine.includes('Quanto gastei hoje?') && engine.includes('Quanto recebi no ano passado?')],
 ['Sugestoes sem repeticao na busca',(() => { const line = engine.split('  search: [')[1]?.split('],')[0] || ''; const matches = Array.from(line.matchAll(/'([^']+)'/g), m => m[1]); return matches.length === 12 && new Set(matches).size === 12 })()],
 ['Boas vindas premium',screen.includes('Experimente um comando de verdade')],
 ['Feedback claro e dados preservados',screen.includes('Nenhuma ação é salva automaticamente.')],
 ['Zero dados nunca vira sucesso inventado',screen.includes('Não encontrei registros para esta frase')],
 ['Gemini manual',screen.includes('stageAssistantQuestionHandoff')&&screen.includes("router.push('/assistant/chat')")],
 ['Chat nao envia ao abrir',chat.includes('consumeAssistantQuestionHandoff(user.id, effectiveContext)')&&chat.includes('const handleSend = async () => {')],
 ['Troca de contexto continua isolada',screen.includes("financialSearchRequestKey(user?.id, context as 'dfl' | 'personal', trimmedQuery, searchAttempt)")],
 ['Regra canonica nos motores numéricos',current.includes('filterRealizedFinancialTransactions')],
 ['Nenhuma escrita no novo motor',!/\b(fetch|localStorage|sessionStorage|indexedDB|db\.|supabase|\.put\(|\.add\()/.test(source)],
 ['Sem URL externa',!/https?:\/\//.test(source)],
 ['Workflow executa R433',workflow.includes('node scripts/check-r433-scoped-finance.mjs')],
 ['Workflow executa R434',workflow.includes('node scripts/check-r434-demo-premium.mjs')],
]
for(const [name,val] of gate)yes(name,val)
console.log(`R434: ${checks} verificacoes de intencao, primeira demonstracao, seguranca, sintaxe, regressao e CI aprovadas`)
