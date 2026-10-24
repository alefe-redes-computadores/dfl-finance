import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
const read=p=>fs.readFileSync(p,'utf8')
const engine=read('src/lib/financeReview.ts'),page=read('src/app/(app)/review/page.tsx')
const bot=read('supabase/functions/whatsapp-webhook/index.ts')
const app=read('src/app/(app)/assistant/page.tsx'),more=read('src/app/(app)/more/page.tsx')
const wf=read('.github/workflows/android-build.yml')
let count=0
function check(name,ok){assert.ok(ok,name);console.log('✓ '+name);count++}
const transpile=(source,filename)=>{
  const x=ts.transpileModule(source,{fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},reportDiagnostics:true})
  check('Sem erro TSX/TS '+filename,!x.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error));return x.outputText
}
const code=transpile(engine,'financeReview.ts');transpile(page,'review/page.tsx')
const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:()=>{throw Error('engine deve ser puro')},Date,Number,String,Array,Map,Set,Math,Object,RegExp,encodeURIComponent}, {timeout:3000})
const fn=module.exports.buildFinancialReview
const date=new Date(2026,9,24,12)
const base=(id,desc,amount,dt,rest={})=>({id,user_id:'owner',context:'personal',account_id:'a1',type:'expense',status:'done',affects_balance:true,category_id:'food',description:desc,amount,date:dt,...rest})
const rows=[base('a','Gasolina posto',80,'2026-10-22'),base('b','Gasolina posto',80,'2026-10-22'),base('c','Aluguel',900,'2026-10-01'),base('d','Mercado',60,'2026-10-20',{category_id:null}),base('e','Cartão',350,'2026-10-18',{credit_card_id:'card'}),base('f','Pagamento',500,'2026-10-20',{type:'transfer',transfer_group_id:'tr'}),base('g','Venda pendente',10000,'2026-10-23',{status:'pending',type:'income'}),base('h','OCR',60,'2026-10-20',{status:'pending',source:'ai_ocr'}),base('i','Salário',1000,'2026-10-21',{type:'income'})]
const monthly=[base('r1','Streaming',35,'2026-08-03'),base('r2','Streaming',35,'2026-09-03'),base('r3','Streaming',35,'2026-10-03')]
const accounts=[{id:'a1',name:'Carteira',context:'personal'}],cats=[{id:'food',name:'Alimentação',context:'personal'}]
const review=fn([...rows,...monthly],accounts,cats,[],'personal',date)
const ids=(kind)=>review.items.filter(x=>x.kind===kind)
check('Tem duplicidade com evidencia e link de detalhe',ids('duplicate').some(x=>x.id.includes('a:b')&&x.href.includes('/transactions/details')))
check('Importado pendente vai para Inbox sem efetivar',ids('inbox').some(x=>x.href==='/conciliation'))
check('Transacao sem categoria identificada',ids('metadata').some(x=>x.id==='metadata-category:d'))
check('Recorrencia de tres meses sugerida mas nao criada',ids('recurring').some(x=>x.detail==='Streaming'&&x.href==='/subscriptions'))
check('Pendente nao entra em entradas realizadas',review.income===1000)
check('Compra no cartao e transferencia nao inflam saidas',review.expense===80+80+900+60+35)
check('Contexto empresa isolado',fn(rows,accounts,cats,[],'dfl',date).items.length===0)
check('Nao altera objetos de entrada',rows[0].description==='Gasolina posto'&&rows[0].status==='done')
check('Sugestao recorrencia nao duplica assinatura cadastrada',fn(monthly,accounts,cats,[{name:'Streaming',context:'personal',status:'active'}],'personal',date).items.filter(x=>x.kind==='recurring').length===0)
check('Nao duplica movimentacoes com a mesma chave de recorrencia',fn([base('z1','Plano',39,'2026-10-05',{recurring_group_id:'r'}),base('z2','Plano',39,'2026-10-05',{recurring_group_id:'r'})],accounts,cats,[],'personal',date).items.filter(x=>x.kind==='duplicate').length===0)
check('Sem dados mostra zero com honestidade',fn([],[],[],[],'personal',date).records===0)
check('Pagina tem filtros e exclusao visual local',page.includes("{id:'duplicate',label:'Repetidos'}")&&page.includes('localStorage.setItem(storageKey')&&page.includes('Restaurar sugestões ignoradas'))
check('Pagina nao faz RPC nem apaga movimentacoes',!page.includes('.delete(')&&!page.includes('safeAdd(')&&!page.includes('safeUpdate(')&&!page.includes('.rpc('))
check('Radar via WhatsApp apenas read-only',bot.includes('/* V169_FINANCIAL_RADAR_START')&&bot.includes('/* V169_FINANCIAL_RADAR_END'))
const radar=bot.slice(bot.indexOf('/* V169_FINANCIAL_RADAR_START'),bot.indexOf('/* V169_FINANCIAL_RADAR_END'))
check('Radar nao chama RPC, mutacao ou transacao financeira',!radar.includes('db.rpc(')&&!radar.includes('.insert(')&&!radar.includes('.update(')&&!radar.includes('.delete('))
check('Radar escopado por user e com limite',radar.includes('.eq("user_id",u.user_id)')&&radar.includes('.limit(900)'))
check('Radar separa contas/transferencias/cartao e pendencias',radar.includes('.eq("status","done")')&&radar.includes('.is("credit_card_id",null)')&&radar.includes('.is("transfer_group_id",null)'))
check('Radar usa 7 dias mais 7 dias e declara limites',radar.includes('botShiftCivil(today,-13)')&&radar.includes('botShiftCivil(today,-6)')&&radar.includes('Não inclui cartão'))
check('V168 de datas preservada',bot.includes('/* V168_FINANCIAL_DATE_HELPERS_START'))
check('V163 anti-duplicidade e confirmacao preservadas',bot.includes('p_idempotency_key:key')&&bot.includes('bot_settle_transaction'))
check('Acessos no menu Mais e Inteligencia',more.includes('href="/review"')&&app.includes("router.push('/review')"))
check('V167 formulario completo ainda preservado',read('src/components/BottomNav.tsx').includes('aria-label="Nova transação completa"'))
check('Workflow exige gate V169',wf.includes('node scripts/check-v169-financial-review.mjs'))
check('A funcao da lanchonete nao foi tocada',!engine.includes('dfl-messaging-ingest')&&!bot.includes('BOT_LANCHONETE_V169'))
console.log(`\nV169: ${count} contratos de produto aprovados`)
