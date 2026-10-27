import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
import vm from 'node:vm'
const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const ui=fs.readFileSync('src/app/(app)/conciliation/page.tsx','utf8')
const begin=wh.indexOf('/* R123: confirma revisao identificada')
const end=wh.indexOf('  /* V163:',begin)
assert.ok(begin>=0&&end>begin,'Guarda nao isolavel')
const code=wh.slice(begin,end)
const cases=[
 ['revisao solicitada comparada com a atual',code.includes('requested!==currentRevision')],
 ['versao invalida nao passa',code.includes('Number.isSafeInteger(requested)')],
 ['erro nao segue para confirmacao',code.includes('return new Response("OK")')],
 ['correcao nunca chama RPC aqui',!code.includes('db.rpc(')],
 ['confirmacao sem versao preservada',code.includes('conversationalChoice(text,"TX_CONFIRM")')],
 ['RPC idempotente existente',wh.includes('p_idempotency_key:key')],
 ['revisao R122 ainda avanca',wh.includes('next.proposal_revision=')],
 ['WhatsApp rotulado na Inbox',ui.includes('WhatsApp · revisar dados')],
 ['OCR rotulado na Inbox',ui.includes('Comprovante · revisar dados')],
 ['importacao rotulada na Inbox',ui.includes('Importação · revisar dados')],
 ['politica de revisao utilizada',ui.includes('financialReviewReason(tx)')],
 ['filtro de pendencias intacto',ui.includes('belongsInFinancialInbox(tx, today)')]
]
for(const [name,pass] of cases){assert.ok(pass,name);console.log('OK:',name)}
async function simulate(input,rev){
 const state={n:input,text:input,sd:{proposal_revision:rev},aid:'fake',reply:async()=>{state.replied=true;return 'ok'},done:async()=>{},Response,conversationalChoice:()=>{state.legacy=true;return 'confirm'}}
 state.globalThis=state
 await vm.runInNewContext('(async()=>{'+code.replace('  const choice=declaredRevision?"confirm":conversationalChoice(text,"TX_CONFIRM");','  globalThis.result=declaredRevision?"confirm":conversationalChoice(text,"TX_CONFIRM");')+'})()',state,{timeout:2000})
 return state
}
const stale=await simulate('confirmar revisao 1',2)
assert.equal(stale.replied,true)
assert.equal(stale.legacy,undefined)
const current=await simulate('confirmar revisao 2',2)
assert.equal(current.result,'confirm')
const simple=await simulate('sim',2)
assert.equal(simple.legacy,true)
console.log('OK: revisao antiga bloqueada, atual aceita e fluxo legado preservado')
console.log('R123–R124: 15 verificacoes aprovadas')
