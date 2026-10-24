import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
const read=(p)=>fs.readFileSync(p,'utf8')
const helper=read('supabase/functions/_shared/financeComparisons.ts')
const bot=read('supabase/functions/whatsapp-webhook/index.ts')
const app=read('src/app/(app)/assistant/page.tsx')
const wf=read('.github/workflows/android-build.yml')
let checked=0
const check=(msg,val)=>{assert.ok(val,msg);checked++;console.log('✓ '+msg)}
const compiled=ts.transpileModule(helper,{fileName:'financeComparisons.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true})
check('Helper TS compila sem erro sintático',!compiled.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error))
const exp={};vm.runInNewContext(compiled.outputText,{module:{exports:exp},exports:exp,Date,String,Number,Map,Array,Math,RegExp,Object},{timeout:3000})
const {parseFinanceComparison:parse,aggregateFinanceMonths:aggregate,financeCompareDelta:delta,monthLabel}=exp
const n=x=>JSON.parse(JSON.stringify(x))
const date='2026-10-24'
check('Compara meses escritos',n(parse('comparar setembro e outubro empresa',date)).months.join(',')==='2026-09,2026-10')
check('Aceita acentos e contexto pessoal',parse('COMPARAR setembro e outubro PESSOAL',date).context==='personal')
check('Compara dois ISO YYYY-MM',parse('comparar 2026-07 e 2026-08',date).months[0]==='2026-07')
check('Compara 09/26 e 10/26',parse('comparar 09/26 e 10/26',date).months[1]==='2026-10')
check('Ano único explícito aplicado aos dois meses',parse('comparar janeiro e fevereiro de 2025',date).months[0]==='2025-01')
check('Meses invertidos ordenados',parse('comparar outubro e setembro',date).months[0]==='2026-09')
check('Rejeita mesmo mês',parse('comparar outubro e outubro',date).kind==='invalid')
check('Rejeita mês futuro',parse('comparar outubro e dezembro',date).kind==='invalid')
check('Rejeita compare incompleto',parse('comparar agosto',date).kind==='invalid')
check('Consulta normal não interceptada',parse('gastei 15 no mercado',date)===null)
check('Evolução 3 meses gera sequência válida',n(parse('evolução últimos 3 meses',date)).months.join(',')==='2026-08,2026-09,2026-10')
check('Evolução 6 meses suporta contexto',parse('tendência 6 meses pessoal',date).months.length===6&&parse('tendência 6 meses pessoal',date).context==='personal')
check('Virada de ano no histórico',n(parse('evolucao ultimos 3 meses','2027-01-10')).months.join(',')==='2026-11,2026-12,2027-01')
check('Label amigável',monthLabel('2026-09')==='Setembro/2026')
const rows=[
{date:'2026-09-12',context:'dfl',status:'done',affects_balance:true,type:'income',amount:500},
{date:'2026-09-12',context:'dfl',status:'done',affects_balance:true,type:'expense',amount:100},
{date:'2026-09-12',context:'personal',status:'done',affects_balance:true,type:'expense',amount:40},
{date:'2026-09-12',context:'dfl',status:'pending',affects_balance:false,type:'expense',amount:999},
{date:'2026-09-12',context:'dfl',status:'done',affects_balance:true,type:'transfer',amount:70},
{date:'2026-09-12',context:'dfl',status:'done',affects_balance:true,type:'expense',amount:200,credit_card_id:'card1'},
{date:'2026-09-12',context:'dfl',status:'done',affects_balance:true,type:'expense',amount:200,invoice_id:'invoice1'},
{date:'2026-09-12',context:'dfl',status:'done',affects_balance:true,type:'expense',amount:200,goal_id:'goal1'},
{date:'2026-10-07',context:'dfl',status:'done',affects_balance:true,type:'sangria',amount:75},
{date:'2026-10-07',context:'dfl',status:'done',affects_balance:true,type:'income',amount:0},
{date:'2026-10-07',context:'dfl',status:'done',affects_balance:true,type:'income',amount:NaN}
]
const company=aggregate(rows,['2026-09','2026-10'],'dfl')
check('Não mistura Empresa/Pessoal',company[0].expense===100)
check('Exclui pendentes e cartões/faturas/metas',company[0].count===2)
check('Sangria considerada saída realizada',company[1].expense===75)
check('Receita e saldo econômico separados',company[0].net===400)
check('Mês vazio tem total zero',aggregate([],['2026-08'],null)[0].net===0)
check('Não aceita números não finitos/zero',company[1].income===0)
check('Não muda dados de origem',rows[0].amount===500)
check('Comparação sem base anterior transparente',delta(200,0)==='sem base anterior')
check('Variação matemática clara',delta(100,200)==='-50.0%')
const from=bot.indexOf('/* V171_FINANCE_COMPARE_START'),to=bot.indexOf('/* V171_FINANCE_COMPARE_END')
check('Handler do bot presente',from>0&&to>from)
const segment=bot.slice(from,to)
check('Consulta sem mutação financeira',!/(?:db\.rpc\(|\.insert\(|\.update\(|\.delete\()/.test(segment))
check('Consulta isolada por usuário',segment.includes('.eq("user_id",u.user_id)'))
check('Limite de linhas e aviso de parcialidade',segment.includes('.limit(1200)')&&segment.includes('incomplete'))
check('Filtra status e dinheiro realizado',segment.includes('.eq("status","done")')&&segment.includes('.eq("affects_balance",true)'))
check('Arquivo modular importado',bot.includes("from '../_shared/financeComparisons.ts'"))
check('V168-170 preservadas',bot.includes('V168_FINANCIAL_DATE_HELPERS_START')&&bot.includes('V169_FINANCIAL_RADAR_START')&&bot.includes('V170_UNIFIED_AGENDA_BOT_START'))
check('Guias atualizados com os comandos',app.includes('comparar setembro e outubro empresa')&&app.includes('evolução últimos 6 meses pessoal'))
check('Pipeline Android exige gate V171',wf.includes('node scripts/check-v171-bot-insights.mjs'))
console.log(`\nV171 BOT INSIGHTS: ${checked} contratos aprovados sem acessar banco nem WhatsApp.`)
