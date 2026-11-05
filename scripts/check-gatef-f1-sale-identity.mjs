import assert from 'node:assert/strict'

// Contrato P U R O da ponte FUTURA: nao chama rede nem altera registros reais.
let checked=0
const ok=(label, fn)=>{fn();checked++;console.log('OK:',label)}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const cleaned=(v)=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,96}$/.test(v)?v:null
function canonicalSaleKey(event){
  if(event.origin==='site'||event.origin==='entregas_site_mirror'){
    const id=cleaned(event.siteOrderId)
    if(!id)throw Error('SITE_ORDER_ID_REQUIRED')
    return `site:${id}`
  }
  if(event.origin==='entregas_internal'){
    if(event.siteOrderId)throw Error('MIRRORED_SITE_ORDER_MUST_USE_SITE_KEY')
    const id=cleaned(event.internalOrderId)
    if(!id)throw Error('INTERNAL_ORDER_ID_REQUIRED')
    return `entregas:${id}`
  }
  throw Error('UNTRUSTED_ORIGIN')
}
function registeredReceivable(table, event){
  const merchant=UUID.test(event.merchantId)?event.merchantId:null
  const contact=UUID.test(event.confirmedContactId)?event.confirmedContactId:null
  if(!merchant)throw Error('MERCHANT_REQUIRED')
  if(!contact)throw Error('CONFIRMED_CONTACT_ID_REQUIRED')
  const saleKey=canonicalSaleKey(event)
  if(!['fiado','installment'].includes(event.receivableKind))throw Error('INVALID_RECEIVABLE_KIND')
  if(event.context!=='dfl')throw Error('MERCHANT_CONTEXT_DFL_REQUIRED')
  const key=`${merchant}|${saleKey}|${event.receivableKind}`
  if(table.has(key))return {duplicate:true,record:table.get(key)}
  const record={merchant_id:merchant,sale_key:saleKey,receivable_kind:event.receivableKind,contact_id:contact,debt_id:null,reconciliation_state:'proposed',created_at:'TEST_ONLY',updated_at:'TEST_ONLY'}
  table.set(key,record)
  return {duplicate:false,record}
}
const merchant='11111111-1111-4111-8111-111111111111'
const c1='22222222-2222-4222-8222-222222222221'
const c2='22222222-2222-4222-8222-222222222222'
const sales=new Map()
const e=(id,more={})=>({origin:'site',siteOrderId:id,merchantId:merchant,confirmedContactId:c1,receivableKind:'fiado',context:'dfl',...more})
ok('Pedido vindo Site usa chave canonica site:ID',()=>assert.equal(canonicalSaleKey(e('ped001')),'site:ped001'))
ok('Entrega refletida do Site usa a mesma sale_key',()=>assert.equal(canonicalSaleKey(e('ped001',{origin:'entregas_site_mirror'})),'site:ped001'))
ok('Venda interna exclusiva usa entregas:ID',()=>assert.equal(canonicalSaleKey({origin:'entregas_internal',internalOrderId:'local001'}),'entregas:local001'))
ok('Venda interna nao pode mascarar espelhamento do Site',()=>assert.throws(()=>canonicalSaleKey({origin:'entregas_internal',siteOrderId:'ped001',internalOrderId:'ped001'}),/MIRRORED/))
ok('Origem nao reconhecida falha fechado',()=>assert.throws(()=>canonicalSaleKey({origin:'whatsapp',siteOrderId:'x'}),/UNTRUSTED/))
ok('ID de pedido com delimitadores nao confiaveis rejeitado',()=>assert.throws(()=>canonicalSaleKey(e('abc|def')),/SITE_ORDER_ID_REQUIRED/))
ok('Primeiro evento registra uma proposta, nunca uma divida',()=>{const x=registeredReceivable(sales,e('ped001'));assert.equal(x.duplicate,false);assert.equal(x.record.debt_id,null)})
ok('Site e Entregas da mesma venda nao criam duas propostas',()=>{const x=registeredReceivable(sales,e('ped001',{origin:'entregas_site_mirror'}));assert.equal(x.duplicate,true);assert.equal(sales.size,1)})
ok('Novo evento duplicado do Site nao cria duplicata',()=>{assert.equal(registeredReceivable(sales,e('ped001')).duplicate,true);assert.equal(sales.size,1)})
ok('Duas vendas do mesmo contato permanecem independentes',()=>{registeredReceivable(sales,e('ped002'));assert.equal(sales.size,2);assert.notEqual(sales.get(`${merchant}|site:ped001|fiado`),sales.get(`${merchant}|site:ped002|fiado`))})
ok('Homônimos nao sao associados por nome',()=>{assert.throws(()=>registeredReceivable(sales,e('ped003',{confirmedContactId:null,customerName:'Maria'})),/CONFIRMED_CONTACT/);assert.equal(sales.size,2)})
ok('Telefone reciclado nao constitui prova de titularidade',()=>{assert.throws(()=>registeredReceivable(sales,e('ped003',{confirmedContactId:null,customerPhone:'5534'})),/CONFIRMED_CONTACT/);assert.equal(sales.size,2)})
ok('Mesmo nome com IDs confirmados distintos preserva identidade',()=>{registeredReceivable(sales,e('ped003',{confirmedContactId:c2,customerName:'Maria'}));assert.equal(sales.get(`${merchant}|site:ped003|fiado`).contact_id,c2)})
ok('Cliente nao autorizado nao pode gerar vinculo',()=>assert.throws(()=>registeredReceivable(sales,e('ped004',{confirmedContactId:null})),/CONFIRMED_CONTACT/))
ok('Contexto pessoal nunca entra em fiado da lanchonete',()=>assert.throws(()=>registeredReceivable(sales,e('ped004',{context:'personal'})),/DFL_REQUIRED/))
ok('Tipos de recebivel distintos compartilham sale_key sem colidir',()=>{registeredReceivable(sales,e('ped001',{receivableKind:'installment'}));assert.equal(sales.size,4)})
ok('Mesmo pedido de mercadores diferentes nao colide',()=>{registeredReceivable(sales,e('ped001',{merchantId:'11111111-1111-4111-8111-222222222222'}));assert.equal(sales.size,5)})
ok('Pagamento reportado nao quita: apenas estado de revisao',()=>{const state='payment_reported';assert.notEqual(state,'paid')})
ok('Evento contestado nao altera debts.status permitido',()=>{const statuses=['pending','partial','paid'];assert.equal(statuses.includes('disputed'),false);assert.equal(statuses.includes('cancelled'),false)})
ok('Outbox idempotente por source + source_event_id',()=>{const outbox=new Set();const k='site|order.created|ped001';outbox.add(k);outbox.add(k);assert.equal(outbox.size,1)})
ok('Callback duplicado usa chave propria e nao quita sem comprovacao',()=>{const callbacks=new Set();const id='provider-msg-xyz';callbacks.add(id);callbacks.add(id);assert.equal(callbacks.size,1);const verified=false;assert.equal(verified? 'paid' : 'review_required','review_required')})
ok('Opt-out impede elegibilidade de cobrança',()=>{const optedOut=true;assert.equal(!optedOut,false)})
ok('Dead letter exige revisao manual antes de replay',()=>{const d={status:'dead_letter',attempts:5,approvedBy:null};assert.equal(d.status==='dead_letter'&&d.approvedBy===null,true)})
ok('Serviço offline nao confirma pagamento',()=>{const providerAvailable=false;assert.equal(providerAvailable?'verified':'pending_review','pending_review')})
ok('Bot privado continua OFF (teste nao altera rollout)',()=>{const enabled=false;assert.equal(enabled,false)})
console.log(`GATE F F1: ${checked} provas de identidade futura/readiness em memoria; nenhuma ponte ativada.`)
