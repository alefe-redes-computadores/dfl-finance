import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = file => fs.readFileSync(file, 'utf8')
let checks = 0
const eq = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks++ }
const ok = (label, valid) => { assert.ok(valid, label); checks++ }
const path = 'src/lib/financialQuestion360.ts'
const code = read(path)
const program = ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true})
eq('Motor transpila',program.diagnostics?.length??0,0)
const mock = {
  filterRealizedFinancialTransactions: (rows,opts)=>rows.filter(x=>x.context===opts.context&&x.date>=opts.start&&x.date<=opts.end&&!x.transfer_group_id&&!x.goal_id&&x.type!=='transfer'&&(!x.invoice_id||x.credit_card_id)&&((x.credit_card_id&&x.type==='expense'&&['done','pending'].includes(x.status))||(x.status==='done'&&x.affects_balance!==false&&['income','expense','sangria'].includes(x.type)))),
  getFinancialFlowSummary: rows=>({income:rows.filter(x=>x.type==='income').reduce((s,x)=>s+x.amount,0),expense:rows.filter(x=>['expense','sangria'].includes(x.type)).reduce((s,x)=>s+x.amount,0),balance:rows.reduce((s,x)=>s+(x.type==='income'?x.amount:-x.amount),0),count:rows.length}),
}
const exports = {}
new Function('exports','require',program.outputText)(exports, moduleName=>{eq('Import apenas metricas canonicas',moduleName,'@/lib/financialMetrics');return mock})
const {interpretFinancialQuestion360:interpret,answerFinancialQuestion360:answer,financial360Destination:destination}=exports
// R2: evita TS2802 em configuracoes com target ES5/legado.
ok('Nao usa matchAll iteravel nem exige downlevelIteration', !code.includes('.matchAll('))
ok('Varredura sem estado global compartilhado', code.includes('new RegExp(monthToken.source, monthToken.flags)'))
const date = new Date(2026,10,3,12)
const ask = q=>interpret(q,date)
for (let i=0;i<4;i++) {
  eq(`R2 meses em consultas repetidas ${i}`,
    ask('compare despesas de outubro com novembro')?.periods?.map(p=>p.key),
    ['2026-10','2026-11'])
  eq(`R2 ano explicito preservado ${i}`,
    ask('quais despesas pendentes de novembro de 2025')?.month?.key,
    '2025-11')
}
for(const [phrase,kind,extra] of [
  ['compare despesas de outubro com novembro','comparison','expense'],
  ['comparar receitas de outubro e novembro','comparison','income'],
  ['comparar resultado deste mês com mês passado','comparison','net'],
  ['gastei mais mês passado versus este mês','comparison','expense'],
  ['despesas pendentes','pending-expenses',undefined],
  ['despesas pendentes em outubro','pending-expenses','2026-10'],
  ['quais despesas pendentes de novembro de 2025','pending-expenses','2025-11'],
  ['quanto tenho de despesas pendentes','pending-expenses',undefined],
  ['quanto tenho para receber','receivables',undefined],
  ['quem me deve','receivables',undefined],
  ['valores a receber','receivables',undefined],
  ['faturas em aberto','open-invoices',undefined],
  ['quanto devo nas faturas','open-invoices',undefined],
  ['o que vence nos próximos 7 dias','due','all'],
  ['quais faturas vencem nos próximos 15 dias','due','invoices'],
  ['quais contas vencem esta semana','due','all'],
]){
  const r=ask(phrase)
  eq(`Intent ${phrase}`,r?.kind,kind)
  if(kind==='comparison')eq(`Metrica ${phrase}`,r.metric,extra)
  if(kind==='pending-expenses'&&extra)eq(`Mes ${phrase}`,r.month?.key,extra)
  if(kind==='due')eq(`Fonte ${phrase}`,r.dueSource,extra)
}
for(const phrase of [
  'comparar despesas do Nubank em outubro e novembro',
  'por que minhas despesas aumentaram?',
  'compare minhas despesas em outubro',
  'comparar despesas outubro com outubro',
  'comparar despesas do ano de 2025 e 2026',
  'despesas pendentes do cartão',
  'despesas pendentes de um período qualquer',
  'quanto gastei no cartão Nubank',
  'novo cartão',
  'criar fatura',
  'transferir entre contas',
  'o que vence nos próximos 90 dias',
  'meus saldos bancários',
]) eq(`Nenhum palpite ${phrase}`,ask(phrase),null)
const context='dfl'
const transactions=[
  {id:'income10',context,type:'income',amount:1000,status:'done',date:'2026-10-01'},
  {id:'expense10',context,type:'expense',amount:200,status:'done',date:'2026-10-03',description:'Mercado'},
  {id:'card10',context,type:'expense',amount:80,status:'pending',date:'2026-10-04',credit_card_id:'c1'},
  {id:'invoice10',context,type:'expense',amount:90,status:'done',date:'2026-10-05',invoice_id:'inv1'},
  {id:'transfer10',context,type:'transfer',amount:4000,status:'done',date:'2026-10-05'},
  {id:'income11',context,type:'income',amount:1500,status:'done',date:'2026-11-02'},
  {id:'expense11',context,type:'expense',amount:400,status:'done',date:'2026-11-02'},
  {id:'pending11',context,type:'expense',amount:60,status:'pending',date:'2026-11-06',due_date:'2026-11-06',description:'Telefone'},
  {id:'pendingCard',context,type:'expense',amount:80,status:'pending',date:'2026-11-07',credit_card_id:'c1'},
  {id:'pf',context:'personal',type:'expense',amount:5000,status:'pending',date:'2026-11-06'},
]
const invoices=[{id:'i1',context,credit_card_id:'c1',status:'open',total_amount:400,paid_amount:50,due_date:'2026-11-07'}, {id:'i2',context:'personal',credit_card_id:'c1',status:'open',total_amount:9000,paid_amount:0,due_date:'2026-11-07'}]
const cards=[{id:'c1',context,name:'Nubank'}]
const debts=[{id:'d1',context,person_name:'Contato',total_amount:130,paid_amount:30,status:'partial',due_date:'2026-11-07'}, {id:'d2',context:'personal',person_name:'Outro',total_amount:2000,paid_amount:0,status:'pending'}]
const subs=[{id:'s1',context,name:'Assinatura',next_due_date:'2026-11-05',amount:49,status:'active'}]
const loans=[{id:'l1',context,description:'Empréstimo pessoal',remaining_amount:1000,due_date:'2026-11-08',direction:'borrowed',status:'active'}]
const financings=[{id:'f1',context,name:'Veículo',next_due_date:'2026-11-05',installment_value:289,status:'active'}]
const data={transactions,invoices,cards,debts,subscriptions:subs,loans,financings}
const cmp=answer(ask('compare despesas de outubro com novembro'),data,context)
eq('Comparativo no contexto',cmp.first?.amount,280)
eq('Comparativo novembro',cmp.second?.amount,480)
eq('Comparativo diferencia',cmp.difference,-200)
eq('Comparativo exclui pagamento de fatura e transferência',cmp.first?.count,3)
const pf=answer(ask('despesas pendentes'),data,context)
eq('Pendente soma sem compra no cartao',pf.total,60)
eq('Pendente quantidade',pf.count,1)
const receivable=answer(ask('quanto tenho para receber'),data,context)
eq('Valor a receber liquido',receivable.total,100)
eq('Nao exibe valores PF',receivable.count,1)
const invoice=answer(ask('faturas em aberto'),data,context)
eq('Fatura saldo restante sem PF',invoice.total,350)
eq('Fatura abre detalhe por cartao',invoice.items[0].href,'/cards/details?id=c1')
const due=answer(ask('o que vence nos próximos 7 dias'),data,context)
eq('Vencimentos multiplas fontes',due.count,5)
eq('Vencimentos nao somam origens',due.total,undefined)
eq('Vencimentos incluem assinatura',due.items.some(x=>x.source==='Assinatura'),true)
eq('Vencimentos incluindo financiamento',due.items.some(x=>x.source==='Parcela de financiamento'),true)
const onlyInvoices=answer(ask('quais faturas vencem nos próximos 15 dias'),data,context)
eq('Filtra vencimentos por fatura',onlyInvoices.count,1)
const missing=answer(ask('quanto tenho para receber'),{debts:[]},context)
eq('Sem dados nao afirma zero',missing.state,'no-data')
const lacking=answer(ask('compare despesas de outubro com novembro'),{transactions:transactions.filter(x=>x.date<'2026-11-01')},context)
eq('Mes ausente nao inventa comparacao',lacking.state,'insufficient')
for(const kind of ['comparison','pending-expenses','receivables','open-invoices','due']) {
  const prompt = {comparison:'compare despesas outubro com novembro','pending-expenses':'despesas pendentes','receivables':'quanto tenho para receber','open-invoices':'faturas em aberto',due:'o que vence nos próximos 7 dias'}[kind]
  ok(`Destino seguro ${kind}`,/^\/(?!\/)/.test(destination(ask(prompt))))
}
for(const path of ['src/components/FinancialQuestion360Answer.tsx','src/app/(app)/search/page.tsx','src/lib/financialQuestion360.ts']) {
  const ast=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  eq('Sintaxe '+path,ast.parseDiagnostics.length,0)
}
const search=read('src/app/(app)/search/page.tsx')
const ui=read('src/components/FinancialQuestion360Answer.tsx')
const ci=read('.github/workflows/android-build.yml')
for(const [label,condition] of [
 ['R430 mantido',search.includes('interpretFinancialReadOnlyQuestion(trimmedQuery)')],
 ['R431 mantido',search.includes('resolveFinancialHelp(trimmedQuery)')],
 ['R429 mantido',search.includes('resolveExtendedFinancialCommands(trimmedQuery)')],
 ['R432 nova interpretacao',search.includes('interpretFinancialQuestion360(trimmedQuery)')],
 ['R432 nova UI',search.includes('<FinancialQuestion360Answer question={question360}')],
 ['R432 sem varredura Busca para intent',search.includes('if (question360) {')],
 ['R432 nao mostra resultados vazios para resposta',search.includes('helpIntent || readOnlyIntent || question360 ? null')],
 ['Gemini segue por gesto',search.includes('onTalk={continueWithGemini}')],
 ['Filtro usuario/contexto transacoes',ui.includes("where('[user_id+context+date]')")],
 ['Filtro user/context em faturas sem indice combinado',ui.includes("where('user_id').equals(userId).and(item => item.context === context)")],
 ['Exibicao isolada de snapshot anterior',ui.includes('result?.key === key && userId')],
 ['Nenhum dado enviado ao Gemini na UI',!ui.includes('fetch(')&&!ui.includes('streamChatMessage')],
 ['R431 preservado no Android',ci.includes('node scripts/check-r431-final-command-help.mjs')],
 ['R432 no Android',ci.includes('node scripts/check-r432-financial-360.mjs')],
 ['Motor sem rede/escrita',!/(?:fetch\(|indexedDB|localStorage|sessionStorage|\.put\(|\.add\(|supabase)/.test(code)],
])ok(label,condition)
console.log(`R432: ${checks} verificacoes de interpretacao, indices, contexto, financas e CI aprovadas`)
