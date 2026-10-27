import fs from 'node:fs'
import assert from 'node:assert/strict'
import {PGlite} from '@electric-sql/pglite'
const sql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026194500_r170_atomic_single_v2.sql','utf8')
const test=fs.readFileSync('scripts/check-r170-r176-atomic-v2.mjs','utf8')
const helper=fs.readFileSync('supabase/functions/_shared/atomicBotSingleV2.ts','utf8')
const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
assert.match(sql,/DFL_BOT_INCOMPLETE_SNAPSHOT/)
assert.match(sql,/temp_data \?& array\[/)
assert.ok(!sql.includes("s.temp_data ? 'account_id' and"))
assert.ok(!sql.includes("s.temp_data ? 'idempotency_key' and"))
assert.ok(!wh.includes('atomicBotSingleV2'),'V2 ainda deve estar desligada')
assert.ok(helper.includes("db.rpc('dfl_bot_commit_single_v2'"))
assert.ok(!helper.includes("db.rpc('dfl_bot_session_cas'"))
assert.ok(test.includes("proposal_id:'tx:'+key"))
const db=new PGlite()
try { await db.exec('create table test_snapshot(data jsonb not null);')
 const complete={proposal_id:'tx:1',user_id:'user',account_id:'account',category_id:null,idempotency_key:'key',type:'expense',amount:10,description:'Despesa',context:'personal',date:'2026-10-26'}
 const keys=['proposal_id','user_id','account_id','category_id','idempotency_key','type','amount','description','context','date']
 for(const k of keys){const obj={...complete};delete obj[k];const q=await db.query('select ($1::jsonb ?& $2::text[]) as required', [JSON.stringify(obj),keys]);assert.equal(q.rows[0].required,false,'campo ausente deve falhar: '+k);console.log('OK: snapshot incompleto bloqueado:',k)}
 const good=await db.query('select ($1::jsonb ?& $2::text[]) as required',[JSON.stringify(complete),keys]);assert.equal(good.rows[0].required,true)
 console.log('R177-R183: campos de identidade e autorizacao obrigatorios validados no PGlite')
}finally{await db.close()}
