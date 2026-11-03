import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = p => fs.readFileSync(p, 'utf8')
let checks = 0
const eq = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks++ }
const ok = (label, actual) => { assert.ok(actual, label); checks++ }
const parse = (p, kind) => {
  const ast = ts.createSourceFile(p, read(p), ts.ScriptTarget.Latest, true, kind)
  eq('Sintaxe TS/TSX: ' + p, ast.parseDiagnostics.length, 0)
}
const transpile = (p, requireShim = () => { throw Error('Import nao esperado') }) => {
  const result = ts.transpileModule(read(p), { compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true })
  eq('Transpilacao: ' + p, result.diagnostics?.length ?? 0, 0)
  const exports = {}
  new Function('exports', 'require', result.outputText)(exports, requireShim)
  return exports
}
const metrics = {
  isExpenseTransaction: tx => tx.type === 'expense' || tx.type === 'sangria',
  filterRealizedFinancialTransactions: (rows, options) => rows.filter(tx => {
    if (tx.context !== options.context || tx.date < options.start || tx.date > options.end) return false
    if (tx.transfer_group_id || tx.type === 'transfer' || tx.goal_id) return false
    if (tx.credit_card_id && tx.type === 'expense') return ['pending', 'done'].includes(tx.status)
    if (tx.invoice_id && !tx.credit_card_id) return false
    return tx.status === 'done' && tx.affects_balance !== false && ['income', 'expense', 'sangria'].includes(tx.type)
  }),
  getFinancialFlowSummary: rows => {
    const income = rows.filter(tx => tx.type === 'income').reduce((n, tx) => n + tx.amount, 0)
    const expense = rows.filter(tx => tx.type === 'expense' || tx.type === 'sangria').reduce((n, tx) => n + tx.amount, 0)
    return { income, expense, balance: income - expense, count: rows.length }
  },
}
const path = 'src/lib/financialReadOnlyQuestions.ts'
const source = read(path)
const engine = transpile(path, name => {
  eq('So importa a fonte de metricas', name, '@/lib/financialMetrics')
  return metrics
})
const query = (phrase, date = new Date(2026, 10, 3, 12)) => engine.interpretFinancialReadOnlyQuestion(phrase, date)
const cases = [
  ['Quanto gastei este mês?', 'expense', '2026-11'],
  ['quanto gastei no mês passado', 'expense', '2026-10'],
  ['quanto recebi em outubro', 'income', '2026-10'],
  ['QUANTO RECEBI EM OUTUBRO DE 2025?', 'income', '2025-10'],
  ['total de despesas em 10/26', 'expense', '2026-10'],
  ['quanto gastei com alimentação no mês passado', 'category-expense', '2026-10'],
  ['qual a categoria com mais gastos em outubro', 'top-category', '2026-10'],
  ['Como estão minhas finanças?', 'flow', '2026-11'],
  ['resumo financeiro em janeiro de 2026', 'flow', '2026-01'],
  ['quanto recebi no mes anterior', 'income', '2026-10'],
]
for (const [phrase, kind, month] of cases) {
  const result = query(phrase)
  eq(`Tipo: ${phrase}`, result?.kind, kind)
  eq(`Periodo: ${phrase}`, result?.month, month)
}
for (const phrase of [
  'quanto gastei no cartão Nubank', 'despesas pendentes em novembro',
  'por que minhas contas aumentaram?', 'compare minhas despesas com o ano passado',
  'quanto devo a Pedro', 'mostre dados do Nubank', 'quando vencerá o cartão?',
  'quanto gastei esta semana', 'quanto gastei com mercado em 2024-11',
  'quanto gastei com cartão', 'nova despesa', 'novo cartão',
]) eq(`Pergunta aberta nao recebe total inventado: ${phrase}`, query(phrase), null)
eq('Vira ano ao voltar de janeiro', query('quanto gastei mês passado', new Date(2026,0,3,12))?.month, '2025-12')

const r = query('resumo financeiro em outubro')
const samples = [
  { context: 'dfl', type: 'income', amount: 900, status: 'done', date: '2026-10-04' },
  { context: 'dfl', type: 'expense', amount: 120, status: 'done', date: '2026-10-05', category_id: 'food' },
  { context: 'dfl', type: 'expense', amount: 80, status: 'pending', date: '2026-10-05', category_id: 'food' },
  { context: 'dfl', type: 'expense', amount: 50, status: 'pending', date: '2026-10-06', category_id: 'food', credit_card_id: 'card-1' },
  { context: 'dfl', type: 'expense', amount: 500, status: 'done', date: '2026-10-05', category_id: 'food', invoice_id: 'invoice-1' },
  { context: 'dfl', type: 'transfer', amount: 4000, status: 'done', date: '2026-10-05' },
  { context: 'personal', type: 'expense', amount: 9999, status: 'done', date: '2026-10-05', category_id: 'food' },
  { context: 'dfl', type: 'expense', amount: 75, status: 'done', date: '2026-11-05', category_id: 'food' },
]
const categories = [{ id: 'food', name: 'Alimentação' }]
const flow = engine.answerFinancialReadOnlyQuestion(r, samples, categories, 'dfl')
eq('Resumo total receita', flow.income, 900)
eq('Resumo reconhece compra de cartao e evita pagamento duplicado', flow.expense, 170)
eq('Resumo resultado do periodo nao saldo bancario', flow.net, 730)
eq('Resumo so 3 movimentos elegiveis', flow.count, 3)
const cat = engine.answerFinancialReadOnlyQuestion(query('quanto gastei com alimentação em outubro'),samples,categories,'dfl')
eq('Categoria localizada',cat.category,'Alimentação')
eq('Categoria sem transferencia ou pendente',cat.expense,170)
eq('Categoria ausente nao vira total zero',engine.answerFinancialReadOnlyQuestion(query('quanto gastei com saúde em outubro'),samples,categories,'dfl').state,'missing-category')
const blank = engine.answerFinancialReadOnlyQuestion(query('quanto recebi em setembro'),samples,categories,'dfl')
eq('Sem dados nao afirma total zero',blank.state,'no-data')
const top = engine.answerFinancialReadOnlyQuestion(query('qual a categoria com mais gastos em outubro'),samples,categories,'dfl')
eq('Maior categoria',top.category,'Alimentação')
eq('Maior categoria valor',top.expense,170)
for(const symbol of ['filterRealizedFinancialTransactions','getFinancialFlowSummary','isExpenseTransaction']) ok(`Usa metrica canonica ${symbol}`,source.includes(symbol))
ok('Motor local sem IO', !/fetch\(|indexedDB|sessionStorage|localStorage|supabase|\.add\(|\.put\(/.test(source))

const handoffPath='src/lib/assistantChatHandoff.ts'
const map = new Map()
global.window = { sessionStorage: { setItem:(k,v)=>map.set(k,v), getItem:k=>map.get(k)??null, removeItem:k=>map.delete(k) } }
const handoff = transpile(handoffPath)
const user='11111111-2222-4333-8444-555555555555'
ok('Handoff explicitamente encenado',handoff.stageAssistantQuestionHandoff(user,'dfl','Quanto gastei em outubro?'))
eq('Contexto diferente nao recebe texto',handoff.consumeAssistantQuestionHandoff(user,'personal'),null)
eq('Handoff consumido apos contexto divergente',handoff.consumeAssistantQuestionHandoff(user,'dfl'),null)
ok('Nova pergunta pode ser encenada',handoff.stageAssistantQuestionHandoff(user,'dfl','  alguma    pergunta  '))
eq('Pergunta preenche chat uma vez',handoff.consumeAssistantQuestionHandoff(user,'dfl'),'alguma pergunta')
eq('Pergunta nao reaparece',handoff.consumeAssistantQuestionHandoff(user,'dfl'),null)
ok('Pergunta extensa nao vira handoff',!handoff.stageAssistantQuestionHandoff(user,'dfl','x'.repeat(300)))
ok('Handoff sem rede e sem cookies',!/fetch\(|localStorage|cookie|supabase/.test(read(handoffPath)))

delete global.window
for (const p of [path,handoffPath]) parse(p,ts.ScriptKind.TS)
for (const p of ['src/components/FinancialReadOnlyAnswer.tsx','src/app/(app)/search/page.tsx','src/app/(app)/assistant/chat/page.tsx']) parse(p,ts.ScriptKind.TSX)
const screen=read('src/app/(app)/search/page.tsx')
const chat=read('src/app/(app)/assistant/chat/page.tsx')
const ui=read('src/components/FinancialReadOnlyAnswer.tsx')
const ci=read('.github/workflows/android-build.yml')
for(const [label,pass] of [
  ['Pergunta so local se inequivoca',screen.includes('interpretFinancialReadOnlyQuestion(trimmedQuery)')],
  ['Busca preserva motor R429',screen.includes('resolveExtendedFinancialCommands(trimmedQuery)')],
  ['Busca preserva motor R428',screen.includes('isFinancialCommandOnlyQuery(trimmedQuery, commands.map(command => command.id))')],
  ['Busca preserva isolamento R424',screen.includes("if (searchPhase !== 'ready') return []")],
  ['Busca nao varre tables para resposta local',screen.includes('if (readOnlyIntent) {')],
  ['Resposta local e componente dedicado',screen.includes('<FinancialReadOnlyAnswer question={readOnlyIntent}')],
  ['Chat Gemini so com gesto explicito',screen.includes('const continueWithGemini = () => {') && screen.includes("router.push('/assistant/chat')")],
  ['Chat nao recebe query na URL',!screen.includes('/assistant/chat?q=')],
  ['Handoff isolado ao contexto atual',chat.includes('consumeAssistantQuestionHandoff(user.id, effectiveContext)')],
  ['Handoff nao dispara envio',!chat.match(/consumeAssistantQuestionHandoff[^}]*handleSend\(/)],
  ['Chat existente preserva opcao ligada/desligada',chat.includes('if (!aiEnabled) {')],
  ['Chat respeita envio manual',chat.includes('const handleSend = async () => {')],
  ['UI consulta indice por usuario/contexto/data',ui.includes("where('[user_id+context+date]')")],
  ['UI consulta categorias por usuario e contexto',ui.includes("where('[user_id+context]')")],
  ['UI nao envia dados para o Gemini',!ui.includes('fetch(')&&!ui.includes('streamChatMessage')],
  ['UI nao confunde balanco com saldo bancario',ui.includes('não é saldo bancário')],
  ['R429 permanece no Android',ci.includes('node scripts/check-r429-command-discovery.mjs')],
  ['R430 no Android',ci.includes('node scripts/check-r430-hybrid-finance.mjs')],
]) ok(label,pass)
console.log(`R430: ${checks} contratos de leitura local, periodo, seguranca, Gemini opt-in, contexto e CI aprovados`)
