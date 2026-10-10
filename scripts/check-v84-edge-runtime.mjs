import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

function evaluate(file, requireFn, deno = {}) {
  const source = fs.readFileSync(file, 'utf8')
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  assert.equal(parsed.parseDiagnostics.length, 0, `Syntax error in ${file}`)
  const js = ts.transpileModule(source, { fileName:file, compilerOptions:{
    module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2020, esModuleInterop:true,
  }}).outputText
  const exports={}
  new Function('require','exports','Deno',js)(requireFn,exports,deno)
  return exports
}
const security=evaluate('supabase/functions/_shared/requestSecurity.ts',()=>{throw Error('unexpected import')})
const env={SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'internal-test-secret',
 EVOLUTION_API_KEY:'evolution-test-secret',EVOLUTION_API_URL:'https://evolution.test',EVOLUTION_INSTANCE:'test'}
const deno={env:{get:key=>env[key]}}
let checks=0
async function check(name,fn){await fn();checks++;console.log('OK:',name)}
const jsonRequest=(body,headers={})=>new Request('https://example.test/webhook',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body)})
function handler(file, client, webPush={setVapidDetails(){},async sendNotification(){}}){
 let serveHandler
 evaluate(file,name=>{
  if(name.includes('requestSecurity'))return security
  if(name.includes('/http/server'))return{serve:fn=>{serveHandler=fn}}
  if(name.includes('supabase-js'))return{createClient:()=>client}
  if(name==='npm:web-push')return webPush
  throw Error('Unexpected import '+name)
 },deno)
 assert.equal(typeof serveHandler,'function')
 return serveHandler
}
const uid='00000000-0000-4000-8000-000000000001'
const event={apikey:env.EVOLUTION_API_KEY,event:'messages.upsert',data:{key:{id:'provider-test',remoteJid:'5511999999999@s.whatsapp.net',fromMe:false},message:{imageMessage:{mimetype:'image/png',fileLength:100}}}}
function mediaClient({session=null,target=null}={}){
 const calls={db:0,upload:0,remove:0,targetReads:0,updates:[]}
 const client={from(table){
  calls.db++
  let mode='select',body
  const query={select(){return query},eq(){return query},is(){return query},order(){return query},limit(){return query},
   insert(value){mode='insert';body=value;return query},update(value){mode='update';body=value;calls.updates.push({table,value});return query},
   async maybeSingle(){
    if(table==='user_phones')return{data:{user_id:uid,phone:'5511999999999'},error:null}
    if(table==='bot_sessions')return{data:session,error:null}
    if(table==='transactions')return{data:typeof target==='function'?target(++calls.targetReads):target,error:null}
    return{data:null,error:null}
   },async single(){return{data:mode==='insert'?{id:'audit-test'}:body,error:null}},
   then(resolve,reject){return Promise.resolve({data:null,error:null}).then(resolve,reject)},
  };return query
 },storage:{from(){return{async upload(){calls.upload++;return{error:null}},async remove(){calls.remove++;return{error:null}}}}}}
 return{client,calls}
}
await check('missing or wrong webhook credential fails closed before DB access',async()=>{
 const {client,calls}=mediaClient(), fn=handler('supabase/functions/whatsapp-webhook/index.ts',client)
 const body=structuredClone(event);delete body.apikey
 assert.equal((await fn(jsonRequest(body))).status,401)
 body.apikey='wrong';assert.equal((await fn(jsonRequest(body))).status,401)
 assert.equal(calls.db,0);assert.equal(calls.upload,0)
})
await check('authenticated arbitrary media without financial context never uploads',async()=>{
 const {client,calls}=mediaClient(),fn=handler('supabase/functions/whatsapp-webhook/index.ts',client)
 const previous=globalThis.fetch;globalThis.fetch=async()=>{throw Error('No external fetch should happen')}
 try{assert.equal((await fn(jsonRequest(event))).status,200)}finally{globalThis.fetch=previous}
 assert.equal(calls.upload,0)
 assert.ok(calls.updates.some(x=>x.value.extracted_json?.action==='media.ignored_no_financial_context'))
})
await check('stale transaction destination is rejected before storage',async()=>{
 const {client,calls}=mediaClient({session:{step:'TX_SETTLE',temp_data:{transaction_id:'missing'}}})
 const fn=handler('supabase/functions/whatsapp-webhook/index.ts',client)
 const previous=globalThis.fetch;globalThis.fetch=async()=>{throw Error('No external fetch should happen')}
 try{assert.equal((await fn(jsonRequest(event))).status,200)}finally{globalThis.fetch=previous}
 assert.equal(calls.upload,0)
 assert.ok(calls.updates.some(x=>x.value.extracted_json?.action==='media.ignored_invalid_destination'))
})
await check('concurrent link to the same receipt path is preserved',async()=>{
 const receiptPath=uid+'/whatsapp/provider-test.png'
 const {client,calls}=mediaClient({session:{step:'TX_SETTLE',temp_data:{transaction_id:'financial-test'}},
   target:n=>({id:'financial-test',receipt_url:n===1?null:receiptPath})})
 const fn=handler('supabase/functions/whatsapp-webhook/index.ts',client),previous=globalThis.fetch
 globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('getBase64FromMediaMessage')?
   {base64:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64'),mimetype:'image/png'}:{key:{id:'reply-test'}}),{status:200,headers:{'content-type':'application/json'}})
 try{assert.equal((await fn(jsonRequest(event))).status,200)}finally{globalThis.fetch=previous}
 assert.equal(calls.upload,1);assert.equal(calls.remove,0)
 assert.ok(calls.updates.some(x=>x.table==='whatsapp_messages'&&x.value.media_url===receiptPath&&x.value.transaction_id==='financial-test'))
})
await check('private push endpoint rejects unauthenticated requests before DB',async()=>{
 let queries=0
 const fn=handler('supabase/functions/send-push/index.ts',{from(){queries++;throw Error('unexpected query')}})
 assert.equal((await fn(jsonRequest({notification_id:'test'}))).status,401)
 assert.equal(queries,0)
})
await check('push response hides subscriptions and skips already claimed deliveries',async()=>{
 let sent=0
 const client={from(table){const query={select(){return query},eq(){return query},update(){return query},
   async maybeSingle(){return{data:table==='notifications'?{id:'test',user_id:uid,title:'Teste'}:{preferences:{}},error:null}},
   then(resolve,reject){return Promise.resolve({data:[{id:'subscription-test',endpoint:'https://secret.test/push',p256dh:'key',auth:'secret'}],error:null}).then(resolve,reject)},
  };return query},async rpc(){return{data:false,error:null}}}
 const fn=handler('supabase/functions/send-push/index.ts',client,{setVapidDetails(){},async sendNotification(){sent++}})
 const result=await fn(jsonRequest({notification_id:'test'},{authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}))
 assert.equal(result.status,200);const body=await result.text()
 assert.equal(sent,0);assert.ok(!body.includes('endpoint')&&!body.includes('secret.test'))
})
await check('receipt declared MIME must match bytes',()=>{
 assert.equal(security.receiptMimeMatches(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),true)
 assert.equal(security.receiptMimeMatches(new Uint8Array([137,80,78,71,13,10,26,10]),'application/pdf'),false)
})
await check('webhook JSON has a byte limit',async()=>{
 await assert.rejects(()=>security.readBoundedJson(jsonRequest({text:'x'.repeat(100)}),20),/Body too large/)
})
console.log(`\nV84 EDGE: ${checks} cenários de handler aprovados com dependências simuladas. Sem envio ou deploy real.`)
