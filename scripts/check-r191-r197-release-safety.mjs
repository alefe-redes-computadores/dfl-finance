import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const read=p=>fs.readFileSync(p,'utf8');
const r133=read('docs/sql-candidates/historical-test-fixtures/20261026150000_r133_bot_session_cas.sql');
const v2=read('docs/sql-candidates/historical-test-fixtures/20261026194500_r170_atomic_single_v2.sql');
const webhook=read('supabase/functions/whatsapp-webhook/index.ts');
const bridge=read('supabase/functions/_shared/atomicBotSingleV2.ts');
const old=read('supabase/functions/_shared/atomicBotSingle.ts');
let n=0;const check=(name,condition)=>{assert.ok(condition,name);console.log('OK:',name);n++};
check('R133 cria versionamento da sessao',/alter\s+table\s+public\.bot_sessions/i.test(r133)&&/\brevision\b/i.test(r133));
check('RPC V2 existe',/create\s+or\s+replace\s+function\s+public\.dfl_bot_commit_single_v2\s*\(/i.test(v2));
check('bloqueio transacional da sessao',/bot_sessions[\s\S]*?for\s+update/i.test(v2));
check('RPC V2 chama RPC financeira existente',/public\.bot_record_transaction\s*\(/i.test(v2));
check('SQL recusa snapshot incompleto',/DFL_BOT_INCOMPLETE_SNAPSHOT/.test(v2));
check('SQL impede reuso de autorizacao',/DFL_BOT_ALREADY_CONSUMED/.test(v2));
check('SQL restringe papel executor',/service_role/.test(v2)&&/revoke\s+(?:all|execute)/i.test(v2));
check('helper V2 usa somente RPC atomica para criar lancamento',/db\.rpc\('dfl_bot_commit_single_v2'/.test(bridge)&&!/db\.rpc\('bot_record_transaction'/.test(bridge));
check('helper V2 sem CAS separado',!/db\.rpc\('dfl_bot_session_cas'/.test(bridge));
check('ponte legada ainda existe e nao deve ser removida',/atomicBotSingle/.test(old));
check('webhook ainda nao liga V2 sem ativacao deliberada',!/atomicBotSingleV2\.ts/.test(webhook));
for(const [file,source] of [['webhook',webhook],['atomicBotSingleV2',bridge]]){
 const ast=ts.createSourceFile(file+'.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 check('TypeScript parse '+file,ast.parseDiagnostics.length===0);
}
console.log(`R191-R197: ${n} contratos de seguranca aprovados.`);
console.log('RELEASE BLOQUEADO POR DESENHO: V2 ainda nao integrada ao webhook e nao validada contra ledger completo.');
