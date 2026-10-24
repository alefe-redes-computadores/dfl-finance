import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const engine=read('src/lib/financeAgenda.ts')
const page=read('src/app/(app)/agenda/page.tsx')
const bot=read('supabase/functions/whatsapp-webhook/index.ts')
const more=read('src/app/(app)/more/page.tsx')
const assistant=read('src/app/(app)/assistant/page.tsx')
const review=read('src/app/(app)/review/page.tsx')
const wf=read('.github/workflows/android-build.yml')
let count=0
const check=(label,condition)=>{assert.ok(condition,label);console.log('✓',label);count++}
const parse=(src,filename)=>ts.transpileModule(src,{fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true})
for(const [src,file] of [[engine,'financeAgenda.ts'],[page,'agenda/page.tsx']]){
 const result=parse(src,file)
 check(`Sintaxe TypeScript ${file}`,!(result.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error))
}
const forecast={
 civilISO:date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-'),
 addCivilDays:(start,offset)=>{const [y,m,d]=start.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+offset,12)).toISOString().slice(0,10)},
}
const testModule={exports:{}}
const output=parse(engine,'financeAgenda.ts').outputText
const fakeRequire=key=>{
 if(key==='@/lib/financialForecast')return forecast
 if(key==='@/lib/financialCommitments')return {resolveKnownCommitments:(ctx,tx,sources,now)=>({entries:sources.__mockKnown||[],warnings:['Fonte financeira canônica.']})}
 throw Error('Import inesperado: '+key)
}
vm.runInNewContext(output,{require:fakeRequire,module:testModule,exports:testModule.exports,Date,Number,String,Map,Set,Math,Array,encodeURIComponent}, {timeout:3000})
const {composeFinanceAgenda,buildFinanceAgenda}=testModule.exports
const when=new Date(2028,1,27,12)
const entry=(id,source,date,amount,direction)=>({id,source,date,amount,direction,economic:true,overdue:date<'2028-02-27'})
const known=[
 entry('tx:t1','transaction','2028-02-27',100,'expense'),
 entry('debt:d1','debt','2028-02-26',500,'income'),
 entry('invoice:i1','invoice','2028-02-28',80,'expense'),
 entry('loan:l1','loan','2028-03-02',300,'expense'),
 entry('financing:f1','financing','2028-03-04',49,'expense'),
 entry('tx:t2','transaction','2028-03-01',200,'income'),
 entry('tx:t1','transaction','2028-02-27',100,'expense'), // duplicate ID must be ignored
 entry('tx:future','transaction','2028-08-01',99999,'expense'),
]
const sources={
 debts:[{id:'d1',person_name:'João',context:'personal'}],
 loans:[{id:'l1',description:'Crédito',context:'personal'}],
 financings:[{id:'f1',name:'Moto',context:'personal'}],
 creditInvoices:[{id:'i1',credit_card_id:'c1',context:'personal'}],
 creditCards:[{id:'c1',name:'Cartão A',context:'personal'}],
 subscriptions:[{id:'s1',name:'Streaming',context:'personal',status:'active',amount:39,due_day:31,next_due_date:'2028-01-31',billing_cycle:'monthly'}],
}
const tx=[{id:'t1',context:'personal',description:'Mercado'},{id:'t2',context:'personal',description:'Venda'}]
const model=composeFinanceAgenda(known,tx,sources,'personal',90,when)
check('Somente um lançamento por ID',model.items.filter(x=>x.id==='tx:t1').length===1)
check('Pagamento conhecido de hoje',model.dueNowExpense===100)
check('Recebimento atrasado não aumenta futuro',model.horizonIncome===200)
check('Todos compromissos explícitos de pagar',model.horizonExpense===100+80+300+49)
check('Assinaturas NÃO inflacionam obrigações',model.horizonExpense!==100+80+300+49+model.planningExpense)
check('Assinaturas aparecem como planejamento separado',model.planningCount>=3&&model.items.filter(x=>x.kind==='subscription').every(x=>x.scope==='planning'))
check('Fevereiro bissexto aceita dia 29',model.items.some(x=>x.id==='subscription:s1:2028-02-29'))
check('Março preserva dia 31',model.items.some(x=>x.id==='subscription:s1:2028-03-31'))
check('Abril limita dia 30',model.items.some(x=>x.id==='subscription:s1:2028-04-30'))
check('Vencido conserva cobrança em aberto',model.items.some(x=>x.id==='debt:d1'&&x.overdue))
check('Fatura navega para cartão de origem',model.items.find(x=>x.id==='invoice:i1')?.href==='/cards/details?id=c1')
check('Recebível navega para detalhes sem baixa',model.items.find(x=>x.id==='debt:d1')?.href==='/debts/details?id=d1')
check('Financiamento navega corretamente',model.items.find(x=>x.id==='financing:f1')?.href==='/financings/details?id=f1')
check('Movimentação navega para detalhes',model.items.find(x=>x.id==='tx:t1')?.href==='/transactions/details?id=t1')
check('Eventos além de 90 dias fora',!model.items.some(x=>x.id==='tx:future'))
check('Agenda 7 dias reduz o horizonte',composeFinanceAgenda(known,tx,sources,'personal',7,when).end==='2028-03-04')
check('Horizonte inválido regride a 30 dias',composeFinanceAgenda([],[],{},'personal',12,when).horizonDays===30)
check('Contextos isolam assinaturas',composeFinanceAgenda([],[],sources,'dfl',30,when).planningCount===0)
check('Não altera fontes recebidas',sources.subscriptions[0].next_due_date==='2028-01-31'&&known[0].amount===100)
check('Sem compromisso não cria saldo fictício',composeFinanceAgenda([],[],{},'personal',30,when).horizonIncome===0)
check('Composição por dia e totais separados',model.groups.some(x=>x.date==='2028-02-27'&&x.knownExpense===100))
check('Data inválida descartada',composeFinanceAgenda([entry('tx:bad','transaction','2028-02-31',100,'expense')],[],{},'personal',30,when).knownCount===0)
check('Assinaturas pagas e pausadas ignoradas',composeFinanceAgenda([],[],{subscriptions:[{...sources.subscriptions[0],status:'paused'}]},'personal',30,when).planningCount===0)
check('Motor usa resolução de compromissos existente',engine.includes('resolveKnownCommitments(input.context,input.transactions,input.sources,now)'))
check('Motor não possui acesso a banco nem altera ledger',!engine.includes('safeAdd(')&&!engine.includes('safeUpdate(')&&!engine.includes('db.rpc(')&&!engine.includes('db.table('))
check('Página possui 7/30/90 dias e filtros',page.includes('([7,30,90] as const)')&&page.includes("{id:'overdue',label:'Vencidos'}")&&page.includes("{id:'planning',label:'Planejado'}"))
check('Página separa planejamento explicitamente',page.includes('não entram na soma a pagar')&&page.includes('agenda.planningExpense'))
check('Página não possui ação financeira implícita',!page.includes('safeDelete(')&&!page.includes('safeUpdate(')&&!page.includes('safeAdd(')&&!page.includes('.rpc('))
check('Agenda ligada a Mais, Inteligência e Revisão',more.includes('href="/agenda"')&&assistant.includes("router.push('/agenda')")&&review.includes("router.push('/agenda')"))
const start=bot.indexOf('/* V170_UNIFIED_AGENDA_BOT_START'),end=bot.indexOf('/* V170_UNIFIED_AGENDA_BOT_END')
check('Bot contém consulta de agenda protegida',start>0&&end>start)
const segment=bot.slice(start,end)
check('Bot sem mutações de dinheiro/RPC',!segment.includes('db.rpc(')&&!segment.includes('.update(')&&!segment.includes('.insert(')&&!segment.includes('.delete('))
check('Bot tem filtros por usuário e contexto',segment.includes(".eq('user_id',u.user_id)")&&segment.includes("tq=tq.eq('context',pf.context)"))
check('Bot filtra transferências, faturas e contratos',segment.includes(".is('credit_card_id',null)")&&segment.includes(".is('transfer_group_id',null)")&&segment.includes(".is('loan_id',null)"))
check('Bot mantém assinaturas fora do somatório de obrigações',segment.includes('As assinaturas não foram somadas aos compromissos'))
check('Bot suporta 7, 15, 30 e 90 dias',segment.includes('\\b(7|15|30|90)\\s*dias?\\b'))
check('Bot respeita 60 linhas por tipo e sinaliza parcial',segment.includes('.limit(60)')&&segment.includes('partial:limited'))
check('V168 e V169 preservadas',bot.includes('V168_FINANCIAL_DATE_HELPERS_START')&&bot.includes('V169_FINANCIAL_RADAR_START'))
check('V167 formulários completos preservados',read('src/components/BottomNav.tsx').includes('Nova transação completa'))
check('Workflow exige os testes novos',wf.includes('node scripts/check-v170-finance-agenda.mjs'))
console.log(`\nV170: ${count} contratos aprovados (sem banco ou WhatsApp reais).`)
