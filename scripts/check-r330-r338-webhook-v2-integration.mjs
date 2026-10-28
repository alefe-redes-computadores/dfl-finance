import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'
const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const a=wh.indexOf('async function recordTx('), b=wh.indexOf('async function afterConfirm(',a)
assert.ok(a>0&&b>a,'recordTx real identificado')
const src=wh.slice(a,b)
assert.ok(src.includes('R330_V2_DUAL_GATE'),'roteador novo presente')
assert.ok(src.includes('R299_LEDGER_POSTCOMMIT_VERIFY'),'ledger obrigatorio')
assert.ok(!src.includes('await clear(phone)\n')||src.includes('else await clear(phone)'),'fluxo completo preservado')
const js=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const u={user_id:'user-1'}, acc={id:'acc-1',name:'Inter'},cat={id:'cat-1',name:'Compras'}
const sd={provider_message_id:'message-original',type:'expense',amount:75.2,description:'Fornecedor',context:'dfl',date:'2026-10-27'}
const key='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
async function run({flags={},sessionOkay=true,ledgerOkay=true,recurrence=false,dbError=null,atomicTx='tx-1',protectedCanary=true,consumedRetry=false,unexpectedHandoff=false}={}){
 const events=[]
 const input={...sd,...recurrence?{recurrence:{frequency:'monthly',occurrences:2,label:'Mensal'}}:{}}
 const q=table=>({select(){return this},eq(){return this},is(){return this},async maybeSingle(){
  if(table==='bot_sessions')return {error:dbError,data:sessionOkay?{step:'TX_SETTLE',temp_data:{consumed_at:'2026-10-27T12:00:00Z',idempotency_key:key,transaction_id:atomicTx}}:null}
  if(table==='transactions')return {error:dbError,data:ledgerOkay?{id:atomicTx,user_id:u.user_id,account_id:acc.id,category_id:cat.id,type:sd.type,amount:sd.amount,description:sd.description,context:sd.context,date:sd.date,idempotency_key:key,status:'pending',affects_balance:false}:null}
  throw Error('unknown query '+table)
 }})
 const ctx={
  Deno:{env:{get:name=>flags[name]}},
  r361CanarySqlVisibility:true,
  r358CanaryPendingCopy:(message,v2Mode)=>{
    if(!v2Mode)return message
    const original="*Deseja efetivar agora?*\n*1* — Efetivar e atualizar saldo\n*2* — Manter pendente"
    if(!message.includes(original)){
      throw new Error(
        'DFL_V2_CANARY_REPLY_CONTRACT_CHANGED'
      )
    }
    const result=message.replace(
      original,
      '🧪 *Teste controlado V2*: lançamento registrado como *pendente* para conferência. A efetivação pelo WhatsApp está desativada neste teste.'
    )
    if(result.includes('*1* — Efetivar e atualizar saldo')){
      throw new Error('DFL_R407_CANARY_SETTLE_OFFER_REMAINED')
    }
    return result
  },
  r361IsProtectedCanary:async(userId,txid)=>{
    if(userId!==u.user_id || txid!==atomicTx){
      throw new Error('DFL_R407_CANARY_IDENTITY_MISMATCH')
    }
    events.push('guard:protected-check')
    return protectedCanary
  },
  r369RolloutDecision:async()=>{
    return flags.DFL_BOT_ATOMIC_V2_RELEASE_GATE
      ? 'canary'
      : 'legacy'
  },
  u,phone:'5534999999999',sd:input,acc,cat,aid:'audit',
  uid:async()=>key, day:()=>sd.date, money:v=>'R$ '+v, voiceRegistered:()=> 'Registrado',
  db:{from(table){events.push('read:'+table);return q(table)},async rpc(name){events.push('rpc:'+name);return {data:{transaction_id:atomicTx},error:null}}},
  handoffAtomicV2:async()=>{events.push('handoff');if(consumedRetry)throw new Error('DFL_V2_ORCH_ALREADY_CONSUMED');if(unexpectedHandoff)throw new Error('DB_COMMIT_REJECTED');return {transaction_id:atomicTx,phase:'committed',mode:'atomic_v2'}},
  recoverAtomicV2Handoff:async()=>{events.push('recover');return {transaction_id:atomicTx,verified:true}},
  atomicBotSingle:async()=>{throw Error('V1 proibida')}, atomicBotFinalize:async()=>{throw Error('V1 finalize proibida')},
  save:async()=>{events.push('legacy_save')},clear:async()=>{events.push('clear')},
  reply:async()=>{events.push('reply');return 'ok'},done:async()=>{events.push('done')},
  Error, String,Number,Math,Object,Promise
 }
 vm.runInNewContext(js+';globalThis.__fn=recordTx;',ctx,{timeout:4000})
 try{await ctx.__fn(u,ctx.phone,input,acc,cat,ctx.reply,ctx.aid);return {events}}
 catch(error){return {events,error:String(error)}}
}
const closed=await run({flags:{DFL_BOT_ATOMIC_V2_ENABLED:'true'}})
assert.ok(!closed.error,closed.error)
assert.ok(closed.events.includes('rpc:bot_record_transaction'))
assert.ok(!closed.events.includes('handoff'))
console.log('OK: flag V2 isolada NAO registra')
const v1=await run({flags:{DFL_BOT_ATOMIC_SINGLE_V1:'enabled'}})
assert.match(v1.error,/DFL_ATOMIC_V1_UNSAFE_DISABLED/)
console.log('OK: V1 proibida')
const legacy=await run()
assert.ok(!legacy.error,legacy.error)
assert.ok(legacy.events.includes('rpc:bot_record_transaction'))
assert.ok(legacy.events.includes('legacy_save'))
assert.ok(!legacy.events.includes('handoff'))
console.log('OK: legado OFF inalterado')
const both={DFL_BOT_ATOMIC_V2_ENABLED:'true',DFL_BOT_ATOMIC_V2_RELEASE_GATE:'r330-db-approved'}
const good=await run({flags:both})
assert.ok(!good.error,good.error)
assert.deepEqual(good.events.filter(x=>x==='handoff'),['handoff'])
assert.deepEqual(good.events.filter(x=>x.startsWith('read:')),['read:bot_sessions','read:transactions'])
assert.ok(
  good.events.includes('guard:protected-check'),
  'V2 deve verificar o marcador protegido'
)

const withoutMarker=await run({
  flags:both,
  protectedCanary:false
})

assert.match(
  withoutMarker.error,
  /DFL_R361_CANARY_LEDGER_MARKER_REQUIRED/
)

assert.ok(!withoutMarker.events.includes('legacy_save'))
assert.ok(!withoutMarker.events.includes('reply'))
console.log('OK: sem marcador protegido, V2 falha fechado')

assert.ok(!good.events.includes('legacy_save'))
assert.ok(!good.events.some(x=>x.startsWith('rpc:')))
console.log('OK: modo futuro: handoff, prova de sessao + ledger, SEM sobrescrita de TX_SETTLE')
const retry=await run({flags:both,consumedRetry:true})
assert.ok(!retry.error,retry.error)
assert.deepEqual(retry.events.filter(x=>x==='handoff'||x==='recover'),['handoff','recover'])
assert.ok(!retry.events.includes('legacy_save'))
assert.ok(!retry.events.some(x=>x.startsWith('rpc:')))
console.log('OK: retry consumido recuperado pelo ledger, SEM nova RPC financeira')
const unexpected=await run({flags:both,unexpectedHandoff:true})
assert.match(unexpected.error,/DB_COMMIT_REJECTED/)
assert.ok(!unexpected.events.includes('recover'))
assert.ok(!unexpected.events.some(x=>x.startsWith('rpc:')))
console.log('OK: falha de commit inesperada NAO cai em replay nem legado')
for(const scenario of [{sessionOkay:false},{ledgerOkay:false},{dbError:new Error('db offline')}]){
 const bad=await run({...scenario,flags:both})
 assert.ok(bad.error,'falha obrigatoria')
 assert.ok(!bad.events.includes('legacy_save'))
 assert.ok(!bad.events.some(x=>x.startsWith('rpc:')))
 console.log('OK: verificacao falha fechada:',bad.error.slice(0,105))
}
const recurring=await run({flags:both,recurrence:true})
assert.match(recurring.error,/DFL_ATOMIC_V2_RECURRING_NOT_SUPPORTED/)
assert.ok(!recurring.events.includes('handoff'))
console.log('OK: recorrencia rejeitada no opt-in')
assert.ok(wh.includes("import { handoffAtomicV2, recoverAtomicV2Handoff } from '../_shared/atomicV2WebhookHandoff.ts'"))
assert.ok(!wh.includes("import { atomicBotSingleV2 }"))
console.log('R330-R338: 10 cenarios de roteamento, idempotencia/ledger e ativacao PASS (mocks; nao deploy).')
