import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const start=wh.indexOf('  /* R123: confirma revisao identificada')
const end=wh.indexOf('  /* V163:',start)
assert.ok(start>0&&end>start,'Guarda R123/R125 nao isolavel')
const block=wh.slice(start,end)
const checks=[
 ['prazo apenas para confirmacao explicita',block.includes('if(declaredRevision && sd.proposal_updated_at)')],
 ['resposta antiga bloqueada',block.includes('requested!==currentRevision')],
 ['timestamp futuro bloqueado',block.includes('revisionAge<0')],
 ['prazo de 15 minutos',block.includes('revisionAge>15*60*1000')],
 ['timestamps invalidos bloqueados',block.includes('!Number.isFinite(revisionTime)')],
 ['nenhuma RPC nesta guarda',!block.includes('db.rpc(')],
 ['fluxo simples nao recebe permissao nova',block.includes('conversationalChoice(text,"TX_CONFIRM")')],
 ['atualizacao timestamp no rascunho',wh.includes('next.proposal_updated_at=new Date().toISOString();')],
 ['revisao incrementada preservada',wh.includes('next.proposal_revision=')],
 ['RPC idempotente preservada',wh.includes('p_idempotency_key:key')],
]
for(const [label,ok] of checks){assert.ok(ok,label);console.log('OK:',label)}
const evalCode=block.replace('  const choice=declaredRevision?"confirm":conversationalChoice(text,"TX_CONFIRM");','  globalThis.choice=declaredRevision?"confirm":conversationalChoice(text,"TX_CONFIRM");')
async function simulate(message,rev,date,now){
 const state={text:message,n:message,sd:{proposal_revision:rev,proposal_updated_at:date},aid:'fake',Date:class extends Date {static now(){return now}},Response,conversationalChoice:()=>{state.legacy=true;return 'confirm'},reply:async()=>{state.replied=true;return 'fake'},done:async()=>{}}
 state.globalThis=state
 await vm.runInNewContext('(async()=>{'+evalCode+'})()',state,{timeout:2000})
 return state
}
const now=Date.parse('2026-10-26T15:00:00Z')
const recent='2026-10-26T14:55:00Z',old='2026-10-26T14:00:00Z'
let x=await simulate('confirmar revisao 3',3,recent,now);assert.equal(x.choice,'confirm');assert.equal(x.replied,undefined)
x=await simulate('confirmar revisao 2',3,recent,now);assert.equal(x.replied,true);assert.equal(x.choice,undefined)
x=await simulate('confirmar revisao 3',3,old,now);assert.equal(x.replied,true);assert.equal(x.choice,undefined)
x=await simulate('confirmar revisao 3',3,'data invalida',now);assert.equal(x.replied,true)
x=await simulate('sim',3,old,now);assert.equal(x.legacy,true)
console.log('OK: cinco cenarios comportamentais isolados, sem rede e sem banco')
console.log('R125/R126: '+(checks.length+5)+' contratos aprovados')
