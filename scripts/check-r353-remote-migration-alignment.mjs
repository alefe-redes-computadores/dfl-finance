import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source='docs/sql-candidates/r351-v2-release-bundle.sql';
const installed='supabase/migrations/20261027181246_r351_bot_atomic_v2_release_bundle.sql';
const sha=s=>createHash('sha256').update(s).digest('hex');
const candidate=fs.readFileSync(source,'utf8');
const committed=fs.readFileSync(installed,'utf8');
assert.equal(sha(candidate),'12da3d80e566859a54185460f9d61bb36b3e53f8a7aa28a73acf028bae43114d','SQL R351 local divergiu');
assert.equal(sha(committed),'2d49bb14508318dac6f2e89324d19277ba7f2a59803d1fb87f71674d300ee9c1','SQL R351 da versao remota divergiu');
assert.equal(committed,candidate.replace('\nbegin;\n','\n').replace('\ncommit;\n','\n').replace(/\n+$/, '\n'));
assert.ok(!/^\s*(BEGIN|COMMIT);/mi.test(committed),'Transacao gerenciada pelo aplicador');
for(const file of fs.readdirSync('docs/sql-candidates/historical-test-fixtures')){
 assert.ok(file.endsWith('.sql'));
 assert.ok(!fs.existsSync('supabase/migrations/'+file) || !fs.readFileSync('supabase/migrations/'+file,'utf8').includes('r351_bot_atomic_v2_release_bundle'));
}
const webhook=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8');
for(const x of ['R330_V2_DUAL_GATE','DFL_BOT_ATOMIC_V2_RELEASE_GATE','DFL_R369_ROLLOUT_GATE_UNAVAILABLE','R339_AMBIGUOUS_POSTCOMMIT','R299_LEDGER_POSTCOMMIT_VERIFY'])assert.ok(webhook.includes(x),x);
assert.ok(webhook.includes('const atomicMode=false;'));
console.log('R353 APROVADA: migration remota espelhada, fixtures de testes fora de migrations, sem habilitar V2');
