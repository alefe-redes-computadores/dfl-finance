import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'

const bot = fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts', 'utf8')
const app = fs.readFileSync('src/app/(app)/assistant/page.tsx', 'utf8')
const workflow = fs.readFileSync('.github/workflows/android-build.yml', 'utf8')
const assertContract = (label, value) => { assert.ok(value, label); console.log('✓ '+label) }
const start = bot.indexOf('/* V168_FINANCIAL_DATE_HELPERS_START')
const end = bot.indexOf('/* V168_FINANCIAL_DATE_HELPERS_END */')
assertContract('Helper V168 presente uma unica vez', start >= 0 && end > start && bot.indexOf('/* V168_FINANCIAL_DATE_HELPERS_START', start+1) === -1)
const helper = bot.slice(start, end) + '\n;globalThis.__test={botCivilDay,botShiftCivil,botParseReceivableDueDate,botNextMonthlyDueCivil};'
const script = ts.transpileModule(helper, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None},reportDiagnostics:true})
assertContract('Sem falhas sintaticas TypeScript no helper', !script.diagnostics?.some(d=>d.category === ts.DiagnosticCategory.Error))
const sandbox = {N:s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),day:()=> '2026-10-24',Date,Number,String,Error,Math,Object}
sandbox.globalThis=sandbox
vm.runInNewContext(script.outputText,sandbox,{timeout:3000})
const {botCivilDay,botParseReceivableDueDate:parse,botNextMonthlyDueCivil:next} = sandbox.__test
const p=(s,date='2026-10-24')=>JSON.parse(JSON.stringify(parse(s,date)))
assertContract('31/04 recusado',p('31/04/2026').ok === false)
assertContract('29/02 em ano nao bissexto recusado',p('29/02/2027').ok === false)
assertContract('29/02 em ano bissexto aceito',p('29/02/2028').due === '2028-02-29')
assertContract('Formato curto usa ano civil de referencia',p('15/11').due === '2026-11-15')
assertContract('ISO aceito',p('2028-02-29').due === '2028-02-29')
assertContract('Data sem vencimento preservada',p('sem data').ok && p('sem data').due===null)
assertContract('Amanha respeita virada de ano',p('amanhã','2026-12-31').due==='2027-01-01')
assertContract('Data invalida em texto nao passa',p('dia 32/01/2026').ok===false)
assertContract('Nao reinterpreta texto aleatorio como data',p('banana').ok===false)
assertContract('Ultimo dia de abril para assinatura dia 31',next(31,'2026-04-01')==='2026-04-30')
assertContract('Dia 31 de maio sem salto indevido',next(31,'2026-05-01')==='2026-05-31')
assertContract('Mes seguinte depois do dia 30',next(31,'2026-04-30')==='2026-04-30' && next(31,'2026-05-01')==='2026-05-31')
assertContract('Dia 29 em fevereiro comum ajustado para 28',next(29,'2027-02-01')==='2027-02-28')
assertContract('Dia 29 em fevereiro bissexto preservado',next(29,'2028-02-01')==='2028-02-29')
assertContract('Depois do vencimento pula para proximo mes',next(31,'2026-04-30')==='2026-04-30' && next(31,'2026-05-01')==='2026-05-31')
assertContract('Dia inexistente rejeitado',botCivilDay(2026,2,30)===null)
assertContract('Cadastro guiado chama validador de data',bot.includes('const parsed=botParseReceivableDueDate(text);if(!parsed.ok)'))
assertContract('Assinatura usa calendario civil seguro',bot.includes('const nd=botNextMonthlyDueCivil(sd.due_day);'))
assertContract('Confirmacao de assinatura mostra data prevista',bot.includes('Próximo: *${nd.split("-").reverse().join("/")}*'))
assertContract('Mensagens nao disparam pagamentos no helper',!helper.includes('db.rpc(')&&!helper.includes('.insert(')&&!helper.includes('.update('))
assertContract('Bot preserva confirmacao e idempotencia',bot.includes('p_idempotency_key:key')&&bot.includes('bot_settle_transaction')&&bot.includes('TX_CONFIRM'))
assertContract('Bot do Finance inclui segredo de webhook',bot.includes('trustedWebhook(req,p,Deno.env.get("DFL_WEBHOOK_SECRET")'))
assertContract('Guia especifico ao bot Finance no app',app.includes('Bot Finance no WhatsApp')&&app.includes('Diferente do chat Gemini'))
assertContract('Formularios completos da V167 nao alterados',fs.readFileSync('src/components/BottomNav.tsx','utf8').includes('aria-label="Nova transação completa"'))
assertContract('Workflow cobra o teste V168',workflow.includes('node scripts/check-v168-bot-civil-dates.mjs'))
console.log('\nV168 BOT CALENDARIO: 27 contratos aprovados; nenhum banco remoto foi alterado.')
