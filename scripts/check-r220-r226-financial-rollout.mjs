import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import ts from 'typescript'
const read=p=>fs.readFileSync(p,'utf8')
const wh=read('supabase/functions/whatsapp-webhook/index.ts')
const h=read('supabase/functions/_shared/atomicBotSingleV2.ts')
const sql=read('docs/sql-candidates/historical-test-fixtures/20261026220000_r219_bot_atomic_v2_consolidated.sql')
const manifest={generated:new Date().toISOString(),sources:{},checks:{},blockers:[]}
for(const p of ['supabase/functions/whatsapp-webhook/index.ts','supabase/functions/_shared/atomicBotSingleV2.ts','docs/sql-candidates/historical-test-fixtures/20261026220000_r219_bot_atomic_v2_consolidated.sql'])manifest.sources[p]=crypto.createHash('sha256').update(read(p)).digest('hex')
const check=(name,truth)=>{manifest.checks[name]=!!truth;console.log(truth?'OK: '+name:'BLOQUEADO: '+name);assert.ok(truth,name)}
for(const [name,s] of [['webhook',wh],['helper V2',h]]){
 const parsed=ts.createSourceFile(name+'.ts',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
 check(name+' sem erro de parser TS',parsed.parseDiagnostics.length===0)
}
check('SQL consolidado contem CAS',sql.includes('dfl_bot_session_cas'))
check('SQL consolidado contem RPC V2',sql.includes('dfl_bot_commit_single_v2'))
check('SQL V2 chama motor existente',sql.includes('bot_record_transaction'))
check('SQL usa bloqueio de linha',/for\s+update/i.test(sql))
check('SQL sem exclusao de ledger',!/\b(?:truncate\s+(?:table\s+)?|delete\s+from\s+public\.transactions\b|drop\s+table\s+public\.transactions\b)/i.test(sql))
check('SQL limita permissao a service_role',sql.includes('service_role'))
check('webhook mantem integracao atomica por opt-in',/DFL_BOT_ATOMIC|atomicMode|atomicBotSingle/i.test(wh))
check('helper V2 importa nenhuma chave privada para frontend',!h.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE'))
check('idempotencia do motor original preservada',wh.includes('p_idempotency_key:key'))
// Detectar pontos que precisam de evidencia funcional, nao apenas assercoes textuais.
manifest.blockers=[
 'Falta prova E2E com bot_record_transaction REAL e CAS na mesma transacao SQL no esquema financeiro integral.',
 'Verificar persistencia do snapshot integral ANTES de TX_ACC/TX_CAT e sua identidade vinculada ao provider_message_id.',
 'Verificar que TX_SETTLE nao apaga consumed_at/txid e que replay apos timeout recupera o mesmo ID.',
 'Testar concorrencia entre duas conexoes PostgreSQL, nao apenas PGlite de conexao unica.',
 'Auditar grants e validar assinatura/ownership dos objetos antes de aplicar migracao em producao.',
 'Nao habilitar flag da V2 antes de ter deploy SQL, webhook e smoke test controlado.'
]
fs.writeFileSync('docs/finance-r226-machine-report.json',JSON.stringify(manifest,null,2)+'\n')
console.log('CONTRATOS R220–R226 OK; ATIVACAO PRODUCAO BLOQUEADA POR '+manifest.blockers.length+' pendencias documentadas')
