import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const path='supabase/functions/whatsapp-webhook/index.ts'
const s=fs.readFileSync(path,'utf8')

const checks=[
  ['V1 insegura bloqueada',
    s.includes('DFL_ATOMIC_V1_UNSAFE_DISABLED')],
  ['Decisão remota obrigatória',
    s.includes("db.rpc('dfl_bot_v2_rollout_decision'")],
  ['Erro remoto falha fechado',
    s.includes('DFL_R369_ROLLOUT_GATE_UNAVAILABLE')],
  ['Somente canário autorizado',
    s.includes("canaryDecision==='canary'")],
  ['Identidade canário obrigatória',
    s.includes('DFL_R369_CANARY_INVALID_PRINCIPAL')],
  ['Resposta inválida bloqueada',
    s.includes('DFL_R369_ROLLOUT_GATE_UNAVAILABLE')],
  ['Gate SQL de proteção preservado',
    s.includes('DFL_R361_SQL_GATE_MISSING')],
  ['Recorrência V2 bloqueada',
    s.includes('DFL_ATOMIC_V2_RECURRING_NOT_SUPPORTED')],
  ['Fallback legado congelado',
    s.includes('DFL_V2_FROZEN_LEGACY_FALLBACK_DENIED')],
  ['Orquestrador V2 preservado',
    s.includes('handoffAtomicV2(input)')],
  ['V1 sem ativação automática',
    s.includes('const atomicMode=false')],
]

for(const [name,ok] of checks){
  assert.ok(ok,name)
  console.log('OK:',name)
}

const i=s.indexOf('async function r369RolloutDecision(')
const j=s.indexOf('const canaryDecision=await r369RolloutDecision(')

assert(i>=0 && j>i)

const gate=s.slice(i,j)
assert(gate.includes('result.error'))
assert(gate.includes('throw new Error'))
assert(gate.includes('result.data'))

const ast=ts.createSourceFile(
  path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS
)

assert.equal(ast.parseDiagnostics.length,0)
console.log('R401: gate R369 estruturalmente aprovado')
