import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

let count = 0
const eq = (name, actual, expected) => { assert.deepEqual(actual, expected, name); count++ }
const ok = (name, value) => { assert.ok(value, name); count++ }
const read = path => fs.readFileSync(path, 'utf8')
const enginePath = 'src/lib/financialScopedQuestions.ts'
const code = read(enginePath)
const t = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES5 }, reportDiagnostics: true })
eq('Motor pode ser transpilado em alvo ES5', t.diagnostics?.length ?? 0, 0)
const metrics = {
  filterRealizedFinancialTransactions: (rows, opts) => rows.filter(x =>
    x.context === opts.context && x.date >= opts.start && x.date <= opts.end &&
    (!opts.categoryId || x.category_id === opts.categoryId) &&
    (!opts.accountId || x.account_id === opts.accountId) &&
    !x.transfer_group_id && x.type !== 'transfer' && !x.goal_id &&
    (!x.invoice_id || x.credit_card_id) &&
    ((x.credit_card_id && x.type === 'expense' && ['done','pending'].includes(x.status)) ||
    (x.status === 'done' && x.affects_balance !== false && ['income','expense','sangria'].includes(x.type)))
  ),
  getFinancialFlowSummary: rows => {
    const income = rows.filter(x => x.type === 'income').reduce((a,x) => a + x.amount, 0)
    const expense = rows.filter(x => ['expense','sangria'].includes(x.type)).reduce((a,x) => a + x.amount, 0)
    return { income, expense, balance: income - expense, count: rows.length }
  },
}
const exported = {}
new Function('exports','require',t.outputText)(exported, name => {
  eq('Importa somente metricas oficiais', name, '@/lib/financialMetrics')
  return metrics
})
const { interpretScopedFinancialQuestion: interpret, answerScopedFinancialQuestion: answer } = exported
const at = new Date(2026,10,3,12)
const ask = (text, ref = at) => interpret(text, ref)
for (const [phrase, type, start, end, account, category] of [
  ['Quanto gastei hoje?', 'days', '2026-11-03','2026-11-03',undefined,undefined],
  ['Quanto recebi ontem?', 'days', '2026-11-02','2026-11-02',undefined,undefined],
  ['quanto gastei nos últimos 30 dias?', 'days', '2026-10-05','2026-11-03',undefined,undefined],
  ['quanto gastei nos últimos 7 dias', 'days', '2026-10-28','2026-11-03',undefined,undefined],
  ['quanto gastei esta semana', 'week', '2026-11-02','2026-11-03',undefined,undefined],
  ['Quanto recebi semana passada', 'week', '2026-10-26','2026-11-01',undefined,undefined],
  ['Quanto recebi no ano passado', 'year', '2025-01-01','2025-12-31',undefined,undefined],
  ['Quanto gastei em 2025', 'year', '2025-01-01','2025-12-31',undefined,undefined],
  ['quanto recebi na conta Inter em outubro', 'month', '2026-10-01','2026-10-31','inter',undefined],
  ['Quanto gastei na conta Nubank em outubro de 2025', 'month', '2025-10-01','2025-10-31','nubank',undefined],
  ['Quanto gastei na conta Nubank em 10/26', 'month', '2026-10-01','2026-10-31','nubank',undefined],
  ['quanto gastei na conta Nubank', 'month', '2026-11-01','2026-11-30','nubank',undefined],
  ['quanto gastei com alimentação na conta Nubank em outubro', 'month', '2026-10-01','2026-10-31','nubank','alimentacao'],
  ['quanto gastei na conta Nubank com alimentação este mês', 'month', '2026-11-01','2026-11-30','nubank','alimentacao'],
  ['quanto gastei com alimentação nos últimos 30 dias', 'days', '2026-10-05','2026-11-03',undefined,'alimentacao'],
  ['quanto recebi na conta Inter em novembro de 2026', 'month', '2026-11-01','2026-11-30','inter',undefined],
  ['total de despesas na conta Nubank esta semana', 'week', '2026-11-02','2026-11-03','nubank',undefined],
  ['total de receitas na conta Inter no ano passado', 'year', '2025-01-01','2025-12-31','inter',undefined],
]) {
  const q = ask(phrase)
  ok(`Interpretacao ${phrase}`,q)
  eq(`Tipo ${phrase}`,q.period.type,type)
  eq(`Inicio ${phrase}`,q.period.start,start)
  eq(`Fim ${phrase}`,q.period.end,end)
  eq(`Conta ${phrase}`,q.accountQuery,account)
  eq(`Categoria ${phrase}`,q.categoryQuery,category)
}
for (const x of [
  'quanto gastei este mês', // motor R430
  'quanto gastei com alimentação em outubro', // R430 sem conta
  'como estão minhas finanças', // R430
  'comparar despesas de outubro com novembro', // R432
  'quanto tenho para receber', // R432
  'faturas em aberto', // R432
  'quanto gastei no cartão Nubank', // nao adivinhar origem
  'quanto gastei com Nubank em outubro', // sem evidência de categoria
  'quanto gastei na conta Nubank e Inter', // multiplas contas
  'quanto gastei na conta Nubank ou Inter',
  'quanto gastei na conta Nubank nos últimos 180 dias', // janela sem contrato
  'quanto gastei na conta Nubank semana que vem',
  'quanto gastei na conta Nubank desde fevereiro',
  'quanto devo a Pedro',
  'por que gastei tanto hoje',
  'excluir uma conta',
  'quanto transferi na conta Nubank',
  'quanto gastei na conta Nubank em 2022 e 2023',
]) eq('Nao rouba/nao adivinha '+x,ask(x),null)
eq('Virada de ano: mes passado continua R430',ask('quanto gastei na conta Nubank mes passado',new Date(2026,0,2,12))?.period?.start,'2025-12-01')
eq('Virada semana passada',ask('quanto gastei semana passada',new Date(2026,0,1,12))?.period?.start,'2025-12-22')

const transactions = [
  {id:'e1',context:'dfl',type:'expense',amount:100,status:'done',account_id:'nub',category_id:'food',date:'2026-10-30',description:'Mercado'},
  {id:'e2',context:'dfl',type:'expense',amount:20,status:'done',account_id:'nub',category_id:'transport',date:'2026-11-03',description:'Combustível'},
  {id:'e3',context:'dfl',type:'expense',amount:50,status:'done',account_id:'nub',category_id:'food',date:'2026-11-03',description:'Almoço'},
  {id:'card',context:'dfl',type:'expense',amount:25,status:'pending',account_id:'nub',category_id:'food',date:'2026-11-03',credit_card_id:'card1'},
  {id:'invoice',context:'dfl',type:'expense',amount:200,status:'done',account_id:'nub',category_id:'food',date:'2026-11-03',invoice_id:'i1'},
  {id:'transfer',context:'dfl',type:'transfer',amount:1000,status:'done',account_id:'nub',category_id:'food',date:'2026-11-03'},
  {id:'pending',context:'dfl',type:'expense',amount:400,status:'pending',account_id:'nub',category_id:'food',date:'2026-11-03'},
  {id:'other',context:'dfl',type:'expense',amount:90,status:'done',account_id:'inter',category_id:'food',date:'2026-11-03'},
  {id:'personal',context:'personal',type:'expense',amount:90000,status:'done',account_id:'nub',category_id:'food',date:'2026-11-03'},
  {id:'received',context:'dfl',type:'income',amount:700,status:'done',account_id:'inter',date:'2026-11-02'},
  {id:'old',context:'dfl',type:'expense',amount:800,status:'done',account_id:'nub',category_id:'food',date:'2025-11-03'},
]
const categories=[{id:'food',name:'Alimentação',type:'expense'},{id:'transport',name:'Transporte',type:'expense'}]
const accounts=[{id:'nub',name:'Nubank'},{id:'inter',name:'Inter'}]
const inc=(s)=>answer(ask(s),transactions,categories,accounts,'dfl')
const both=inc('quanto gastei com alimentação na conta Nubank nos últimos 30 dias')
eq('Consulta combinada reconhecida',both.state,'ready')
eq('Categoria certa',both.category,'Alimentação')
eq('Conta certa',both.account,'Nubank')
eq('Sem pagamento de fatura nem transferencia/pending',both.amount,175)
eq('Registros contados',both.count,3)
eq('Nao mistura contexto pessoal',both.records?.some(x=>x.id==='personal'),false)
eq('Links internos somente leitura',both.records?.every(x=>/^\/transactions\/details\?id=/.test(x.href)),true)
const today=inc('quanto gastei hoje')
eq('Gasto hoje filtra dia e ignora outros meses',today.amount,185)
eq('Receitas semana',inc('quanto recebi esta semana')?.amount,700)
eq('Gasto na conta Inter',inc('quanto gastei na conta Inter em novembro')?.amount,90)
eq('Sem dados nao apresenta zero',inc('quanto gastei na conta Inter em outubro')?.state,'no-data')
eq('Conta ausente nao presume zero',inc('quanto gastei na conta Bradesco em outubro')?.state,'missing-account')
eq('Categoria ausente nao presume zero',inc('quanto gastei com saúde na conta Nubank em outubro')?.state,'missing-category')
eq('Ambiguidade de conta nao escolhe sozinha',answer(ask('quanto gastei na conta Nubank em outubro'),transactions,categories,[...accounts,{id:'duplicate',name:'Nubank'}],'dfl').state,'ambiguous-account')
eq('Ambiguidade categoria nao escolhe sozinha',answer(ask('quanto gastei com alimentação na conta Nubank em outubro'),transactions,[...categories,{id:'dupl',name:'Alimentação',type:'expense'}],accounts,'dfl').state,'ambiguous-category')
eq('Data sem resultados nao vira zero',inc('quanto recebi na conta Nubank ontem')?.state,'no-data')
for(const p of [enginePath,'src/components/FinancialScopedAnswer.tsx','src/app/(app)/search/page.tsx','src/lib/financialIntentExpansion.ts']) {
  const syntax=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  eq('Sintaxe '+p,syntax.parseDiagnostics.length,0)
}
const screen=read('src/app/(app)/search/page.tsx')
const ui=read('src/components/FinancialScopedAnswer.tsx')
const ideas=read('src/lib/financialIntentExpansion.ts')
const ci=read('.github/workflows/android-build.yml')
for(const [title,value] of [
 ['R430 preservada',screen.includes('interpretFinancialReadOnlyQuestion(trimmedQuery)')],
 ['R431 preservada',screen.includes('resolveFinancialHelp(trimmedQuery)')],
 ['R432 preservada',screen.includes('interpretFinancialQuestion360(trimmedQuery)')],
 ['R433 integracao',screen.includes('interpretScopedFinancialQuestion(trimmedQuery)')],
 ['R432 mantem contrato de fallback',screen.includes('helpIntent || readOnlyIntent || question360 ? null')],
 ['R433 mostra resposta propria',screen.includes('<FinancialScopedAnswer question={scopedIntent}')],
 ['R433 bloqueia varredura busca genérica',screen.includes('if (scopedIntent) {')],
 ['R433 preserva Gemini somente por toque',screen.includes('onTalk={continueWithGemini}')],
 ['R433 preserva consulta local filtrada',ui.includes("where('[user_id+context+date]')")],
 ['R433 preserva contexto nas categorias',ui.includes("db.categories.where('[user_id+context]')")],
 ['R433 preserva contexto nas contas',ui.includes("db.accounts.where('[user_id+context]')")],
 ['R433 rejeita snapshot antigo',ui.includes('rows?.key === key')],
 ['R433 trata erro local de leitura',ui.includes('rows.failed')],
 ['R433 motor sem IO', !/fetch\(|\.put\(|\.add\(|indexedDB|sessionStorage|localStorage|supabase/.test(code)],
 ['R433 sugestoes variadas', ideas.includes('Quanto gastei hoje?') && ideas.includes('Quanto recebi no ano passado?')],
 ['CI executa R433',ci.includes('node scripts/check-r433-scoped-finance.mjs')],
 ['CI preserva R432',ci.includes('node scripts/check-r432-financial-360.mjs')],
]) ok(title,value)
console.log(`R433: ${count} verificacoes de periodos, contexto, filtros, regressao, seguranca e interface aprovadas`)
