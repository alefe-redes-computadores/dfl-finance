import assert from 'node:assert/strict';
import fs from 'node:fs';
const w=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8');
const v2=fs.readFileSync('supabase/functions/_shared/atomicBotSingleV2.ts','utf8');
const sql=fs.readFileSync('docs/sql-candidates/historical-test-fixtures/20261026194500_r170_atomic_single_v2.sql','utf8');
assert.ok(w.includes('DFL_BOT_ATOMIC_SINGLE_V1'),'ponte V1 deve ser preservada');
assert.ok(w.includes('atomicBotFinalize(db,phone,txid'),'finalizacao V1 deve ser preservada');
assert.ok(
  w.includes("db.rpc('dfl_bot_v2_rollout_decision'") &&
  w.includes('DFL_R369_ROLLOUT_GATE_UNAVAILABLE') &&
  w.includes("canaryDecision==='canary'") &&
  w.includes("if(v2Mode && !r361CanarySqlVisibility)") &&
  w.includes('DFL_ATOMIC_V1_UNSAFE_DISABLED'),
  'V2 exige gate SQL R369 e falha fechada'
);
assert.ok(!w.includes("import { atomicBotSingleV2 }")&&w.includes('handoffAtomicV2(input)'),'V2 somente via orquestrador');
assert.ok(v2.includes("db.rpc('dfl_bot_commit_single_v2'"),'V2 RPC deve continuar isolada');
assert.ok(sql.includes('dfl_bot_commit_single_v2'),'SQL preparatorio V2 preservado');
console.log('R198-R204 R2: bloqueio de ativacao, ponte V1 e V2 isolada aprovados');
