import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
// engine imports ./financePace; transpile both via in-memory require
const transpile=(file)=>ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const cache={};const load=(file)=>{if(cache[file])return cache[file];const e={};new Function('require','exports',transpile(file))((name)=>{if(name==='./financePace')return load('src/lib/financePace.ts');throw Error(name)},e);cache[file]=e;return e}
const p=load('src/lib/financePlanning.ts');let tests=0
const check=(name,fn)=>{fn();tests++;console.log('✓',name)}
const ctx='dfl',today='2026-10-24';const tx=(type,amount,date,other={})=>({id:'abc',context:ctx,type,amount,date,status:'done',affects_balance:true,category_id:'grocery',...other});
const evaluate=(rows, groups={}, reserves=[], limits={})=>p.buildFinancePlanning(rows,[{id:'grocery',name:'Mercado'},{id:'rent',name:'Aluguel'}],ctx,today,{dfl:groups,personal:{}},reserves,limits)
check('Despesas do mês entram como Flexível por padrão',()=>assert.equal(evaluate([tx('expense',100,today)]).spent.flex,100))
check('Despesa com categoria fixa corretamente alocada',()=>assert.equal(evaluate([tx('expense',100,today,{category_id:'rent'})],{rent:'fixed'}).spent.fixed,100))
check('Somatórios não duplicam',()=>assert.equal(evaluate([tx('expense',100,today)]).totalSpent,100))
check('Transferência não entra',()=>assert.equal(evaluate([tx('expense',100,today,{transfer_group_id:'x'})]).totalSpent,0))
check('Pagamento de fatura não entra',()=>assert.equal(evaluate([tx('expense',100,today,{invoice_id:'x'})]).totalSpent,0))
check('Compra cartão pendente conta economicamente',()=>assert.equal(evaluate([tx('expense',100,today,{credit_card_id:'c',status:'pending',affects_balance:false})]).totalSpent,100))
check('Pendente comum não entra',()=>assert.equal(evaluate([tx('expense',100,today,{status:'pending',affects_balance:false})]).totalSpent,0))
check('Receita não entra',()=>assert.equal(evaluate([tx('income',100,today)]).totalSpent,0))
check('Gasto futuro não entra',()=>assert.equal(evaluate([tx('expense',100,'2026-10-26')]).totalSpent,0))
check('Contexto Pessoal isolado',()=>assert.equal(evaluate([tx('expense',100,today,{context:'personal'})]).totalSpent,0))
check('Mês anterior isolado',()=>{let r=evaluate([tx('expense',90,'2026-09-10')]);assert.equal(r.previousSpent.flex,90);assert.equal(r.totalSpent,0)})
check('Limite flexível independente do saldo',()=>{let r=evaluate([tx('expense',100,today)],{},[],{dfl:250,personal:5});assert.equal(r.flexibleRemaining,150);assert.equal(r.flexibleLimit,250)})
check('Limite ausente não inventa disponibilidade',()=>assert.equal(evaluate([]).flexibleRemaining,null))
check('Reserva válida mensal sugerida',()=>{let r=evaluate([] ,{},[{id:'a',name:'IPVA',context:ctx,target_amount:1200,target_date:'2027-09-10',declared_saved:0}]);assert.equal(r.reserveMonthlySuggested,100)})
check('Reserva do próximo mês reparte meses inclusivos',()=>{let r=evaluate([],{},[{id:'a',name:'Seguro',context:ctx,target_amount:600,target_date:'2026-11-12',declared_saved:0}]);assert.equal(r.reserveMonthlySuggested,300)})
check('Declaração manual reduz somente plano',()=>{let r=evaluate([],{},[{id:'a',name:'Seguro',context:ctx,target_amount:600,target_date:'2026-11-12',declared_saved:100}]);assert.equal(r.reserveOutstanding,500);assert.equal(r.totalSpent,0)})
check('Reserva vencida não vira dinheiro',()=>{let r=evaluate([],{},[{id:'a',name:'Conta',context:ctx,target_amount:100,target_date:'2026-09-12',declared_saved:0}]);assert.equal(r.reserves[0].overdue,true);assert.equal(r.reserveMonthlySuggested,100)})
check('Reserva quitada tem reserva sugerida zero',()=>{let r=evaluate([],{},[{id:'a',name:'Conta',context:ctx,target_amount:100,target_date:'2026-12-12',declared_saved:100}]);assert.equal(r.reserveMonthlySuggested,0)})
check('Separação Pessoal Empresa em reservas',()=>assert.equal(evaluate([] ,{},[{id:'a',name:'IPVA',context:'personal',target_amount:1200,target_date:'2027-09-10'}]).reserves.length,0))
check('Data inválida em reserva recusada',()=>assert.equal(p.normalizePlanningReserves([{id:'a',name:'IPVA',context:ctx,target_amount:100,target_date:'2026-02-30'}]).length,0))
check('Reserva com quantidade inválida recusada',()=>assert.equal(p.normalizePlanningReserves([{id:'a',name:'IPVA',context:ctx,target_amount:-2,target_date:'2027-02-28'}]).length,0))
check('Deduplicação por ID',()=>assert.equal(p.normalizePlanningReserves(Array(2).fill({id:'a',name:'IPVA',context:ctx,target_amount:100,target_date:'2027-02-28'})).length,1))
check('Contexto inválido reserva não passa',()=>assert.equal(p.normalizePlanningReserves([{id:'a',name:'IPVA',context:'wrong',target_amount:100,target_date:'2027-02-28'}]).length,0))
check('Group desconhecido não contamina',()=>assert.equal(Object.keys(p.normalizePlanningGroups({dfl:{id:'unknown'}}).dfl).length,0))
check('Dados originais imutáveis',()=>{const a=[tx('expense',100,today)];const before=JSON.stringify(a);evaluate(a);assert.equal(JSON.stringify(a),before)})
check('Período bissexto',()=>assert.equal(p.normalizePlanningReserves([{id:'x',name:'Teste',context:ctx,target_amount:100,target_date:'2028-02-29'}]).length,1))
check('Saldo declarado limitado ao valor alvo',()=>assert.equal(p.normalizePlanningReserves([{id:'a',name:'Teste',context:ctx,target_amount:100,declared_saved:200,target_date:'2027-02-28'}])[0].declared_saved,100))

const a=fs.readFileSync('src/lib/financePlanning.ts','utf8')
const b=fs.readFileSync('supabase/functions/_shared/financePlanning.ts','utf8')
check('PWA e bot mantêm o mesmo motor, com extensão Deno explícita',()=>assert.equal(a.replace("from './financePace'","from './financePace.ts'"),b))
check('Saída de reserva mantém context para editar com segurança',()=>assert.match(a,/reserves:\s*\(PlanningReserve\s*&\s*\{/))
check('Motor compila sem spread de Set ou Map para o target do projeto',()=>{
  for(const source of [a,b])assert.ok(!/\[\s*\.\.\.\s*(?:active|categoriesOut\.values\(\))\s*\]/.test(source))
})
check('Resultado de reserva conserva o contexto real',()=>{
  const reserva={id:'ctx',context:ctx,name:'Teste',target_amount:100,declared_saved:10,target_date:'2027-03-10'}
  assert.equal(evaluate([],{},[reserva]).reserves[0].context,ctx)
})

const read=f=>fs.readFileSync(f,'utf8')
const page=read('src/app/(app)/planning/page.tsx'),bot=read('supabase/functions/whatsapp-webhook/index.ts'),usr=read('src/lib/userSettings.ts'),gate=read('scripts/check-v84-edge-runtime.mjs'),wf=read('.github/workflows/android-build.yml')
check('Tela de planejamento com classificação e criação de reservas',()=>assert.ok(page.includes('saveBucket')&&page.includes('saveReserve')&&page.includes('updateSettings')))
check('Tela não faz operações financeiras no ledger',()=>assert.ok(!/\bdb\.|safeAdd|safeUpdate|\.rpc\(/.test(page)))
check('Excluir reserva exige confirmação',()=>assert.ok(page.includes('window.confirm')))
check('Preferências persistentes normalizadas',()=>assert.ok(usr.includes('normalizePlanningGroups(raw.planning_groups)')&&usr.includes('normalizePlanningReserves(raw.planning_reserves)')&&usr.includes('normalizePlanningFlexLimits(raw.planning_flex_limits)')))
check('Dados de planejamento não substituem limite global',()=>assert.ok(usr.includes('spending_limits:')&&usr.includes('planning_flex_limits:')))
check('Bot V173 presente uma vez',()=>assert.equal(bot.split('V173_FINANCE_PLANNING_BOT_START').length-1,1))
const section=bot.split('/* V173_FINANCE_PLANNING_BOT_START')[1]?.split('/* V173_FINANCE_PLANNING_BOT_END')[0]||''
check('Bot é consulta somente leitura',()=>assert.ok(section.length>1200&&!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|recordTx\(/.test(section)))
check('Bot aplica isolamento do usuário',()=>assert.ok(section.includes(".eq('user_id',u.user_id)")))
check('Bot lê as mesmas preferências do PWA',()=>assert.ok(section.includes('preferences.planning_groups')&&section.includes('preferences.planning_reserves')&&section.includes('preferences.planning_flex_limits')))
check('Bot mostra parcialidade',()=>assert.ok(section.includes('Consulta parcial')&&section.includes('1800')))
check('V84 continua executando módulos reais e rejeitando import inesperado',()=>assert.ok(gate.includes("const financePlanning=evaluate(")&&gate.includes("name==='./financePace.ts'")&&gate.includes("throw Error('Unexpected import '+name)")))
check('Workflow Android exige teste V173',()=>assert.ok(wf.includes('node scripts/check-v173-financial-planning.mjs')))
const syntax=ts.createSourceFile('src/app/(app)/planning/page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
check('Nova página tem sintaxe TSX válida',()=>assert.equal(syntax.parseDiagnostics.length,0))
console.log(`V173: ${tests} contratos de regressão de planejamento aprovados`)
