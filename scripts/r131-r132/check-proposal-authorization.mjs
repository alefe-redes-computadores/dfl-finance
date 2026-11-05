import assert from 'node:assert/strict'
import {validateProposalAuthorization,claimInMemory} from './proposalAuthorization.mjs'
const now=1793000000000
const draft={proposalId:'p-1',revision:2,status:'pending',expiresAt:now+900000}
const req={proposalId:'p-1',revision:2,messageId:'message-a'}
const checks=[
 ['proposta valida',()=>assert.equal(validateProposalAuthorization(draft,req,now).ok,true)],
 ['revisao antiga',()=>assert.equal(validateProposalAuthorization(draft,{...req,revision:1},now).code,'stale')],
 ['revisao futura',()=>assert.equal(validateProposalAuthorization(draft,{...req,revision:3},now).code,'stale')],
 ['outro rascunho',()=>assert.equal(validateProposalAuthorization(draft,{...req,proposalId:'p-2'},now).code,'wrong_proposal')],
 ['mensagem vazia',()=>assert.equal(validateProposalAuthorization(draft,{...req,messageId:''},now).code,'missing_message')],
 ['validade exata expirou',()=>assert.equal(validateProposalAuthorization(draft,req,draft.expiresAt).code,'expired')],
 ['revisao NaN',()=>assert.equal(validateProposalAuthorization({...draft,revision:NaN},req,now).code,'invalid_revision')],
 ['revisao fracionaria',()=>assert.equal(validateProposalAuthorization({...draft,revision:1.5},req,now).code,'invalid_revision')],
 ['proposta consumida',()=>assert.equal(validateProposalAuthorization({...draft,status:'claimed'},req,now).code,'already_claimed')],
 ['sem proposta',()=>assert.equal(validateProposalAuthorization(null,req,now).code,'missing')],
 ['sem expiracao',()=>assert.equal(validateProposalAuthorization({...draft,expiresAt:NaN},req,now).code,'expired')],
 ['dupla confirmacao sequencial',()=>{let s=draft;let successes=0;for(const id of ['a','b']){const o=claimInMemory(s,{...req,messageId:id},now);if(o.result.ok)successes++;s=o.state}assert.equal(successes,1)}],
 ['repeticao mesmo identificador',()=>{let a=claimInMemory(draft,req,now);let b=claimInMemory(a.state,req,now);assert.equal(b.result.code,'already_claimed')}],
]
for(const [name,test] of checks){test();console.log('OK:',name)}
console.log(`R131-R132: ${checks.length} contratos puros PASS`)
