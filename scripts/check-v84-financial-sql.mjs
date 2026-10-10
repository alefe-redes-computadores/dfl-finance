import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const schema = JSON.parse(fs.readFileSync('tests/fixtures/finance-schema-v84.json', 'utf8'))
const names = ['push_subscriptions','profiles','categories','accounts','contacts','credit_cards','debts','loans','financings',
 'subscriptions','tags','budgets','goals','chat_sessions','credit_invoices','transactions','notifications','chat_history']
const constraints = JSON.parse(fs.readFileSync('tests/fixtures/finance-constraints-v84.json','utf8'))
const uid=randomUUID(), other=randomUUID(), account=randomUUID(), category=randomUUID()
const identifier=s=>'"'+s.replaceAll('"','""')+'"'
const colType=type=>type==='ARRAY'?'text[]':type
const validDefault=s=>s?.replaceAll('uuid_generate_v4()', 'gen_random_uuid()')

await db.exec(`create schema auth; create table auth.users(id uuid primary key);
 create role authenticated; create role anon; create role service_role bypassrls;
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth, public to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;`)
for(const name of names){
 const cols=schema[name].map(c=>`${identifier(c.name)} ${colType(c.type)}${c.nullable==='NO'?' not null':''}${c.default?' default '+validDefault(c.default):''}${c.name==='id'?' primary key':''}`)
 await db.exec(`create table public.${identifier(name)}(${cols.join(',')});`)
}
for(const c of constraints){
 if(c.pg_get_constraintdef.startsWith('PRIMARY KEY'))continue
 const table=names.find(n=>c.conname.startsWith(n+'_'))
 await db.exec(`alter table public.${identifier(table)} add constraint ${identifier(c.conname)} ${c.pg_get_constraintdef};`)
}
for(const name of names.filter(n=>n!=='profiles')){
 await db.exec(`alter table public.${identifier(name)} enable row level security;
 grant select,insert,update,delete on public.${identifier(name)} to authenticated;
 create policy owned on public.${identifier(name)} for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());`)
}
await db.exec(`grant select,insert,update on public.profiles to authenticated;
 alter table public.profiles enable row level security;
 create policy owned on public.profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());`)
for (const trigger of JSON.parse(fs.readFileSync('tests/fixtures/finance-triggers-v84.json','utf8'))) { await db.exec(trigger.definition); await db.exec(trigger.trigger) }
await db.exec(fs.readFileSync('supabase/migrations/20261009195028_v84_financial_integrity.sql','utf8'))
assert.equal((await db.query('select enforce_atomic from finance_sync_settings')).rows[0].enforce_atomic,false)
// Activation is deliberately separate from installation. Test the enforced mode.
await db.exec('update finance_sync_settings set enforce_atomic=true where singleton=true')
await db.query('insert into auth.users(id) values ($1),($2)',[uid,other])
await db.query('insert into public.profiles(id) values ($1),($2)',[uid,other])
await db.query("insert into accounts(id,user_id,name,balance,context) values($1,$2,'Teste',100,'dfl')",[account,uid])
await db.query("insert into categories(id,user_id,name,type,context,color,icon) values($1,$2,'Outro','expense','dfl','#000','wallet')",[category,other])
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid])
await db.exec('set role authenticated')
const readAccount=async()=> {
 const row=(await db.query('select to_jsonb(a) data from accounts a where id=$1',[account])).rows[0].data
 observedBalances.set(row.updated_at,row)
 return row
}
const metadata=row=>Object.fromEntries(['name','bank_slug','context','color','allow_negative','order','type','is_archived','bank','icon'].map(k=>[k,row[k]??null]))
let observedBalances=new Map()
const item=(table,operation,id,base,data)=>({table,operation,record_id:id,expected_updated_at:base,data,
 ...(table==='accounts'&&operation==='update'?{base_balance:observedBalances.get(base)?.balance,
  base_metadata:metadata(observedBalances.get(base)||{})}:{})})
const commit=async(items,id=randomUUID())=>(await db.query('select public.dfl_commit_financial_batch($1,$2::jsonb) result',[id,JSON.stringify(items)])).rows[0].result
const tx=(id,type='expense',extra={})=>({id,user_id:uid,type,amount:20,date:'2026-10-09',status:'done',context:'dfl',account_id:account,affects_balance:true,...extra})
let count=0
const check=async(name,fn)=>{await fn();count++;console.log('OK:',name)}
await check('erro no ledger reverte o saldo no mesmo commit',async()=>{
 const before=await readAccount(), id=randomUUID()
 await assert.rejects(()=>commit([item('accounts','update',account,before.updated_at,{...before,balance:80}),item('transactions','create',id,null,tx(id,'invalid'))]))
 assert.equal(Number((await readAccount()).balance),100)
 assert.equal((await db.query('select * from transactions where id=$1',[id])).rows.length,0)
})
let committedItems, batchId
await check('saldo e lançamento confirmados juntos',async()=>{
 const before=await readAccount(), id=randomUUID();batchId=randomUUID()
 committedItems=[item('accounts','update',account,before.updated_at,{...before,balance:80}),item('transactions','create',id,null,tx(id))]
 const result=await commit(committedItems,batchId)
 assert.equal(result.status,'committed'); assert.ok(result.versions['accounts/'+account]);assert.equal(Number((await readAccount()).balance),80)
})
await check('resposta perdida: repetir lote não reaplica dinheiro',async()=>{
 const first=await commit(committedItems,batchId),second=await commit(committedItems,batchId)
 assert.deepEqual(first,second);assert.equal(Number((await readAccount()).balance),80)
 assert.equal((await db.query('select count(*) n from transactions')).rows[0].n,1)
})
await check('identidade reutilizada com outro payload é rejeitada',async()=>{
 const changed=structuredClone(committedItems);changed[0].data.balance=999
 await assert.rejects(()=>commit(changed,batchId),/DFL_IDEMPOTENCY_REUSED/)
})
await check('outro cliente vence antes: conflito preserva saldo e não sobe ledger parcial',async()=>{
 const stale=await readAccount();await db.exec('reset role')
 await db.query('update accounts set balance=70,updated_at=clock_timestamp() where id=$1',[account]);await db.exec('set role authenticated')
 const id=randomUUID()
 await assert.rejects(()=>commit([item('accounts','update',account,stale.updated_at,{...stale,balance:60,name:'Renomeada offline'}),item('transactions','create',id,null,tx(id))]),/DFL_SYNC_CONFLICT/)
 assert.equal(Number((await readAccount()).balance),70)
 assert.equal((await db.query('select * from transactions where id=$1',[id])).rows.length,0)
})
await check('despesa offline soma seu delta ao saldo alterado pelo outro cliente',async()=>{
 const stale=await readAccount();await db.exec('reset role')
 await db.query('update accounts set balance=60 where id=$1',[account]);await db.exec('set role authenticated')
 const id=randomUUID()
 const result=await commit([item('accounts','update',account,stale.updated_at,{...stale,balance:50}),item('transactions','create',id,null,tx(id))])
 assert.equal(Number((await readAccount()).balance),40)
 assert.equal(Number(result.accounts[account].balance),40)
})
await check('referência a categoria de outro usuário é rejeitada com rollback',async()=>{
 const before=await readAccount(),id=randomUUID()
 await assert.rejects(()=>commit([item('accounts','update',account,before.updated_at,{...before,balance:20}),item('transactions','create',id,null,tx(id,'expense',{category_id:category}))]),/DFL_REFERENCE_NOT_OWNED/)
 assert.equal(Number((await readAccount()).balance),40)
})
await check('campo desconhecido não é descartado silenciosamente',async()=>{
 const before=await readAccount()
 await assert.rejects(()=>commit([item('accounts','update',account,before.updated_at,{...before,balance:50,phantom:1})]),/DFL_UNKNOWN_COLUMN/)
})
await check('saldo sem trilha financeira é rejeitado',async()=>{
 const before=await readAccount()
 await assert.rejects(()=>commit([item('accounts','update',account,before.updated_at,{...before,balance:999})]),/DFL_CASH_TRAIL_MISMATCH/)
 assert.equal(Number((await readAccount()).balance),40)
})
await check('lançamento liquidado sem conta atualizada é rejeitado',async()=>{
 const id=randomUUID()
 await assert.rejects(()=>commit([item('transactions','create',id,null,tx(id))]),/DFL_ACCOUNT_EFFECT_MISSING/)
 assert.equal((await db.query('select * from transactions where id=$1',[id])).rows.length,0)
})
await check('contrato atual de empréstimo é aceito sem destino interno fictício',async()=>{
 const id=randomUUID()
 await commit([item('loans','create',id,null,{id,user_id:uid,context:'dfl',amount:200,remaining_amount:200,direction:'lent',description:'Teste',status:'active'})])
 const loan=(await db.query('select * from loans where id=$1',[id])).rows[0]
 assert.equal(Number(loan.total_amount),200);assert.equal(loan.dest_context,null)
})
await check('permissão de administrador não pode ser autoatribuída',async()=>{
 await assert.rejects(()=>db.query('update profiles set is_admin=true where id=$1',[uid]),/server managed/)
 assert.equal((await db.query('select is_admin from profiles where id=$1',[uid])).rows[0].is_admin,false)
})
await check('cliente antigo não pode sobrescrever saldo por upsert isolado',async()=>{
 const before=await readAccount()
 await db.query('update accounts set balance=999 where id=$1',[account])
 assert.equal(Number((await readAccount()).balance),Number(before.balance))
})
await check('RPC de push não é acessível ao cliente autenticado',async()=>{
 await assert.rejects(()=>db.query('select public.dfl_claim_push_delivery($1,$2)',['example',randomUUID()]),/permission denied/)
})
await check('transferência completa chega em duas pernas; excluir uma falha',async()=>{
 const before=await readAccount(),dest=randomUUID(),group=randomUUID(),out=randomUUID(),incoming=randomUUID()
 const transfer=(id,accountId,toAccountId,direction)=>({id,user_id:uid,type:'transfer',amount:20,date:'2026-10-09',
   context:direction==='out'?'dfl':'personal',status:'done',account_id:accountId,to_account_id:toAccountId,
   transfer_group_id:group,transfer_direction:direction,idempotency_key:randomUUID(),affects_balance:false})
 const result=await commit([item('accounts','update',account,before.updated_at,{...before,balance:20}),
   item('accounts','create',dest,null,{id:dest,user_id:uid,name:'Destino',context:'personal',balance:20}),
   item('transactions','create',out,null,transfer(out,account,dest,'out')),
   item('transactions','create',incoming,null,transfer(incoming,dest,account,'in'))])
 assert.equal((await db.query('select count(*) n from transactions where transfer_group_id=$1',[group])).rows[0].n,2)
 const after=await readAccount()
 await assert.rejects(()=>commit([item('accounts','update',account,after.updated_at,{...after,balance:40}),
   item('transactions','delete',out,result.versions['transactions/'+out],null)]),/DFL_TRANSFER_GROUP_INCOMPLETE/)
 assert.equal((await db.query('select count(*) n from transactions where transfer_group_id=$1',[group])).rows[0].n,2)
})
await check('liquidação restaura limite; trocar compra atualiza ambos os cartões',async()=>{
 const card=randomUUID(),second=randomUUID(),purchase=randomUUID()
 const cardRow=id=>({id,user_id:uid,context:'dfl',name:'Cartão',closing_day:10,due_day:20,color:'#000',limit_amount:500})
 let result=await commit([item('credit_cards','create',card,null,cardRow(card)),item('credit_cards','create',second,null,cardRow(second)),
   item('transactions','create',purchase,null,tx(purchase,'expense',{account_id:null,credit_card_id:card,status:'pending',affects_balance:false}))])
 const credit=id=>db.query('select to_jsonb(c) data from credit_cards c where id=$1',[id]).then(r=>r.rows[0].data)
 assert.equal(Number((await credit(card)).available_limit),480)
 const purchaseRow=(await db.query('select to_jsonb(t) data from transactions t where id=$1',[purchase])).rows[0].data
 result=await commit([item('transactions','update',purchase,result.versions['transactions/'+purchase],{...purchaseRow,credit_card_id:second})])
 assert.equal(Number((await credit(card)).available_limit),500)
 assert.equal(Number((await credit(second)).available_limit),480)
 const moved=(await db.query('select to_jsonb(t) data from transactions t where id=$1',[purchase])).rows[0].data
 await commit([item('transactions','update',purchase,result.versions['transactions/'+purchase],{...moved,status:'done',affects_balance:true})])
 assert.equal(Number((await credit(second)).available_limit),500)
})
await check('push repetido não reclama novamente entrega enviada',async()=>{
 await db.exec('reset role')
 await db.exec('grant all on all tables in schema public to service_role')
 const sub=randomUUID(),notice='test-'+randomUUID()
 await db.query("insert into notifications(id,user_id,title) values($1,$2,'Teste')",[notice,uid])
 await db.query("insert into push_subscriptions(id,user_id,endpoint,p256dh,auth) values($1,$2,'https://example.test/push','test','test')",[sub,uid])
 await db.exec('set role service_role')
 const claim=()=>db.query('select public.dfl_claim_push_delivery($1,$2) claimed',[notice,sub]).then(r=>r.rows[0].claimed)
 assert.equal(await claim(),true);assert.equal(await claim(),false)
 await db.query("update finance_push_deliveries set status='sent' where notification_id=$1",[notice])
 assert.equal(await claim(),false)
 await db.exec('reset role;set role authenticated')
})
await check('sem autenticação o RPC não executa operação',async()=>{
 await db.query("select set_config('request.jwt.claim.sub','',false)")
 await assert.rejects(()=>commit(committedItems),/DFL_AUTH_REQUIRED/)
})
console.log(`\nV84 SQL: ${count} cenários de comportamento aprovados; nenhum banco remoto alterado.`)
await db.close()
