import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const webhook=fs.readFileSync(
  'supabase/functions/whatsapp-webhook/index.ts',
  'utf8'
)

const helper=fs.readFileSync(
  'supabase/functions/_shared/atomicBotSingleV2.ts',
  'utf8'
)

for(const [name,source] of [
  ['webhook',webhook],
  ['atomic helper',helper]
]){
  const ast=ts.createSourceFile(
    name+'.ts',source,
    ts.ScriptTarget.Latest,true,ts.ScriptKind.TS
  )
  assert.equal(ast.parseDiagnostics.length,0,name)
}

const a=webhook.indexOf(
  '/* R227_R234_UNSAFE_MODE_GUARD'
)
const b=webhook.indexOf('const r=atomicMode',a)

assert.ok(a>0&&b>a,'roteador financeiro localizado')

const block=webhook.slice(a,b)

for(const value of [
  'DFL_ATOMIC_V1_UNSAFE_DISABLED',
  'const atomicMode=false;',
  'r369RolloutDecision(phone,u.user_id)',
  "canaryDecision==='canary'",
  'DFL_R361_SQL_GATE_MISSING',
  'DFL_ATOMIC_V2_RECURRING_NOT_SUPPORTED',
  'DFL_V2_FROZEN_LEGACY_FALLBACK_DENIED'
]){
  assert.ok(block.includes(value),value)
}

const ga=webhook.indexOf(
  'async function r369RolloutDecision('
)
assert.ok(ga>=0)

const gate=webhook.slice(ga,ga+1800)

assert.ok(
  gate.includes("db.rpc('dfl_bot_v2_rollout_decision'")
)
assert.ok(
  gate.includes('DFL_R369_ROLLOUT_GATE_UNAVAILABLE')
)

assert.ok(webhook.includes('atomicBotFinalize(db,phone,txid'))
assert.ok(webhook.includes('p_idempotency_key:key'))

console.log('R227-R234: gate SQL R369 e V1 bloqueada OK')
