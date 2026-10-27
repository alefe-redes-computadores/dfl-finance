import fs from 'node:fs'
import assert from 'node:assert/strict'
const sql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026150000_r133_bot_session_cas.sql','utf8')
const wh=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const checks=[
 ['CAS em UPDATE condicional',/update public\.bot_sessions[\s\S]+where phone = p_phone[\s\S]+revision = p_expected_revision[\s\S]+step = p_expected_step/.test(sql)],
 ['revisao incrementa atomicamente',sql.includes('revision = revision + 1')],
 ['rejeita revisao negativa',sql.includes('p_expected_revision < 0')],
 ['rejeita payload nao objeto',sql.includes("jsonb_typeof(p_new_temp_data) <> 'object'")],
 ['detecta sessao obsoleta',sql.includes("'STALE_SESSION'")],
 ['escopo de privilegio restrito',sql.includes('to service_role')&&sql.includes('from public, anon, authenticated')],
 ['sem concessao ao cliente',!sql.includes('grant execute on function public.dfl_bot_session_cas(text,bigint,text,text,jsonb) to authenticated')],
 ['sem tabelas financeiras alteradas',!/(alter|update|delete\s+from)\s+(table\s+)?public\.(transactions|accounts|finance_sync_batches)/i.test(sql)],
 ['sem chamada ao ledger',!sql.includes('bot_record_transaction(')&&!sql.includes('bot_settle_transaction(')],
 ['webhook existente preservado',wh.includes('p_idempotency_key:key')&&wh.includes('bot_settle_transaction')],
 ['sem CAS habilitado prematuramente no webhook',!wh.includes('dfl_bot_session_cas')],
]
for(const [label,ok] of checks){assert.ok(ok,label);console.log('OK:',label)}
console.log('R133: '+checks.length+' contratos de SQL aprovado (nao prova concorrencia Postgres real)')
