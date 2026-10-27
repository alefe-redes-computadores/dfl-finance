import assert from 'node:assert/strict'
import fs from 'node:fs'
const sql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026183000_r146_atomic_bot_single_entry.sql','utf8')
const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const old=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026_r142_bot_atomic_proposal_authorization.sql','utf8')
const cas=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026150000_r133_bot_session_cas.sql','utf8')
const tests=[
 ['R133 revision column',cas.includes('add column if not exists revision bigint')],
 ['old wrapper maintained',old.includes('dfl_bot_commit_proposal_r142')],
 ['row lock before ledger',sql.indexOf('for update;')<sql.indexOf('v_result:=public.bot_record_transaction(')],
 ['single-entry only',sql.includes("p_type not in ('income','expense')")],
 ['all current entry stages', ['TX_CONFIRM','TX_ACC','TX_CAT','TX_CAT_ALL'].every(s=>sql.includes("'"+s+"'"))],
 ['explicit proposal identity',sql.includes('v_proposal is distinct from p_expected_proposal')],
 ['strict expected revision',sql.includes('v_revision is distinct from p_expected_revision')],
 ['verified user snapshot',sql.includes("(s.temp_data->>'user_id')::uuid is distinct from p_user_id")],
 ['verified account snapshot',sql.includes("(s.temp_data->>'account_id')::uuid is distinct from p_account_id")],
 ['verified category snapshot',sql.includes("(s.temp_data->>'category_id')::uuid is distinct from p_category_id")],
 ['verified idempotency snapshot',sql.includes("(s.temp_data->>'idempotency_key')::uuid is distinct from p_idempotency_key")],
 ['expiry on corrected proposal',sql.includes("interval '15 minutes'")],
 ['anti replay already consumed',sql.includes('DFL_BOT_ALREADY_CONSUMED')],
 ['session and money in same SQL function',sql.includes('v_result:=public.bot_record_transaction(')&&sql.includes("set step='TX_SETTLE'")],
 ['CAS session increment',sql.includes('revision=revision+1')],
 ['no direct balance updates',!sql.includes('update public.accounts')],
 ['no direct transactions insert',!sql.includes('insert into public.transactions')],
 ['no client privileges',sql.includes('from public,anon,authenticated')],
 ['legacy webhook unchanged',wh.includes('p_idempotency_key:key')&&!wh.includes('dfl_bot_record_single_atomic_r146')],
 ['still guarded rollout',sql.includes('NAO implantado')],
]
for(const [label,ok] of tests){assert.ok(ok,label);console.log('OK:',label)}
console.log(`R146-R150: ${tests.length} contratos aprovados; integracao remota NAO validada.`)
