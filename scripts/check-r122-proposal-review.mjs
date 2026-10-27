import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url)
const source=fs.readFileSync('src/lib/inboxPolicy.ts','utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const exports={}
new Function('require','exports',compiled)(n=>n==='@/lib/financialForecast'?{civilDate:s=>typeof s==='string'?s.slice(0,10):null,civilISO:()=> '2026-10-26'}:require(n),exports)
const row=(source,reviewed_at=null)=>({source,reviewed_at,status:'pending',type:'expense',amount:87.9,affects_balance:false,date:'2026-11-20'})
const cases=[
 ['WhatsApp precisa de revisao',exports.financialReviewReason(row('whatsapp'))==='whatsapp'],
 ['OCR precisa de revisao',exports.financialReviewReason(row('ai_ocr'))==='ocr'],
 ['OFX precisa de revisao',exports.financialReviewReason(row('ofx_import'))==='import'],
 ['CSV precisa de revisao',exports.financialReviewReason(row('csv'))==='import'],
 ['Manual nao inventa revisao',exports.financialReviewReason(row('manual'))===null],
 ['Aprovado nao precisa de revisao',exports.financialReviewReason(row('whatsapp','2026-10-26T12:00:00Z'))===null],
 ['WhatsApp futuro permanece revisavel',exports.belongsInFinancialInbox(row('whatsapp'),'2026-10-26')],
 ['Despesa manual futura nao invade Inbox',!exports.belongsInFinancialInbox(row('manual'),'2026-10-26')],
 ['Transferencia nao invade Inbox',!exports.isInboxCandidate({...row('whatsapp'),type:'transfer'})],
 ['Cartao nao invade Inbox',!exports.isInboxCandidate({...row('whatsapp'),credit_card_id:'c'})],
]
const webhook=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
cases.push(
 ['Revisao do rascunho versionada',webhook.includes('next.proposal_revision=')],
 ['Preview da revisao exibe versao',webhook.includes('revisão ${next.proposal_revision}')],
 ['Confirmacao explicita preservada',webhook.includes('if(choice==="confirm"){\n    await afterConfirm(u,phone,sd,reply,aid)')],
 ['RPC idempotente preservada',webhook.includes('p_idempotency_key:key')],
 ['Revisao nao executa RPC',!webhook.slice(webhook.indexOf('if(s?.step==="TX_CORRECT")'),webhook.indexOf('if(s?.step==="TX_SETTLE")')).includes('db.rpc(')]
)
for(const [name,ok] of cases){assert.ok(ok,name);console.log('OK:',name)}
console.log(`R122: ${cases.length} contratos aprovados`)
