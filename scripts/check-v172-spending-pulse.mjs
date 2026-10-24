import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'

const read = p => fs.readFileSync(p, 'utf8')
const engine = read('src/lib/financePace.ts')
const edge = read('supabase/functions/_shared/financePace.ts')
const bot = read('supabase/functions/whatsapp-webhook/index.ts')
const page = read('src/app/(app)/spending-pulse/page.tsx')
const more = read('src/app/(app)/more/page.tsx')
const assistant = read('src/app/(app)/assistant/page.tsx')
const settings = read('src/lib/userSettings.ts')
const workflow = read('.github/workflows/android-build.yml')
let checks = 0
const check = (name, predicate) => { assert.ok(predicate, name); checks++; console.log('✓', name) }
const js = ts.transpileModule(engine, { fileName:'financePace.ts', compilerOptions: { module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 }, reportDiagnostics:true })
check('Motor TS compila sem erro sintático', !js.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error))
check('PWA e Supabase usam motor idêntico', engine === edge)
const exp = {}
vm.runInNewContext(js.outputText, {module:{exports:exp}, exports:exp, Date, String, Number, Map, Array, Math, RegExp, Object, Intl, Error}, {timeout:3000})
const {buildFinancePace:pulse, shiftCivilDay, isPaceExpense}=exp
const row=(date,amount, extra={})=>({date,amount,context:'dfl',type:'expense',status:'done',affects_balance:true,...extra})
const base=[
  row('2026-10-03',100,{category_id:'food'}),
  row('2026-10-08',50,{category_id:'food'}),
  row('2026-10-11',80,{category_id:'services'}),
  row('2026-10-12',200,{credit_card_id:'cc1',status:'pending',affects_balance:false,category_id:'services'}),
  row('2026-10-13',60,{type:'sangria',category_id:'food'}),
  row('2026-10-14',999,{invoice_id:'invoice1'}),
  row('2026-10-15',99,{transfer_group_id:'tr1'}),
  row('2026-10-16',75,{goal_id:'goal1'}),
  row('2026-10-17',55,{loan_id:'loan1'}),
  row('2026-10-18',55,{debt_id:'debt1'}),
  row('2026-10-19',55,{financing_id:'fin1'}),
  row('2026-10-20',150,{status:'pending',affects_balance:false}),
  row('2026-10-22',120,{type:'income'}),
  row('2026-10-23',44,{context:'personal'}),
  row('2026-10-28',300),
  row('2026-09-03',120),
  row('2026-09-08',110),
  row('2026-09-30',999),
  row('2026-10-05',NaN),
]
const s=pulse(base,'dfl','2026-10-24',700,[{id:'food',name:'Alimentação'},{id:'services',name:'Serviços'}])
check('Só gastos econômicos compatíveis',s.currentExpense===490)
check('Cartão conta no gasto da compra',isPaceExpense(base[3],'dfl')===true)
check('Pagamento de fatura não duplica',isPaceExpense(base[5],'dfl')===false)
check('Transferência excluída',isPaceExpense(base[6],'dfl')===false)
check('Metas, empréstimos e financiamento excluídos',base.slice(7,11).every(x=>!isPaceExpense(x,'dfl')))
check('Pendente comum excluído',!isPaceExpense(base[11],'dfl'))
check('Receitas excluídas',!isPaceExpense(base[12],'dfl'))
check('Sem misturar Pessoal e Empresa',s.currentExpense===490 && pulse(base,'personal','2026-10-24',0).currentExpense===44)
check('Não inclui lançamento futuro',s.currentCount===5)
check('Valor inválido excluído',!isPaceExpense(base[18],'dfl'))
check('Mês passado mesma quantidade de dias',s.previousComparableExpense===230)
check('Mês passado completo separado',s.previousFullExpense===1229)
check('Limite respeitado',s.remainingLimit===210 && s.monthlyLimit===700)
check('Ritmo de referência calculado',Math.abs(s.paceReference-(700*24/31))<0.01)
check('Distribuição diária não altera saldo',s.suggestedDailyMaximum===30)
check('Top categorias corretas',s.topCategories[0].name==='Serviços' && s.topCategories[0].amount===280)
check('Percentual de categoria válido',s.topCategories[0].share > 50)
check('Projeção exige dados mínimos',s.projectedExpense !== null)
check('Sem histórico recente não inventa projeção',pulse([], 'dfl','2026-10-24',500).projectedExpense === null)
check('Limite ausente não vira saldo',pulse(base,'dfl','2026-10-24',0).remainingLimit===null)
check('Virada do ano civil',shiftCivilDay('2027-01-01',-1)==='2026-12-31')
check('Ano bissexto',shiftCivilDay('2028-03-01',-1)==='2028-02-29')
check('Dia inválido rejeitado',(()=>{try{pulse([],'dfl','2026-02-31',0);return false}catch{return true}})())
const begin=bot.indexOf('/* V172_FINANCE_PACE_BOT_START'), end=bot.indexOf('/* V172_FINANCE_PACE_BOT_END')
check('Handler V172 identificado',begin>=0 && end>begin)
const handler=bot.slice(begin,end)
check('Handler do bot apenas lê e responde',!/(?:db\.rpc|\.insert|\.update|\.delete)\(/.test(handler) && handler.includes(".eq('user_id',u.user_id)"))
check('Bot reconhece /ritmo',handler.includes('query.spending_pace.readonly'))
check('Bot consulta usuário autenticado',handler.includes('u.user_id'))
check('Bot limita busca e informa parcialidade',handler.includes('.limit(1800)') && handler.includes('Consulta parcial'))
check('Bot não revela segredo',!handler.includes('SUPABASE_SERVICE_ROLE_KEY'))
check('Bot preserva V171',bot.includes('V171_FINANCE_COMPARE_START'))
check('Bot importa o módulo read-only',bot.includes("from '../_shared/financePace.ts'"))
check('App integra motor e contexto',page.includes('buildFinancePace')&&page.includes('ContextToggle')&&page.includes('useLocalData'))
check('Limite configurável por contexto',settings.includes('spending_limits:')&&page.includes('updateSettings({ preferences:'))
check('Configuração não é transação',!page.includes('safeAdd(')&&!page.includes('safeUpdate('))
check('UI diferencia limite e saldo',page.includes('Não é dinheiro livre no banco'))
check('Mais abre tela de ritmo',more.includes('href="/spending-pulse"'))
check('Assistente aponta para ritmo',assistant.includes("'/spending-pulse'"))
check('Android executa novo gate',workflow.includes('node scripts/check-v172-spending-pulse.mjs'))
console.log(`V172: ${checks} contratos aprovados — dados financeiros intactos.`)
