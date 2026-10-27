import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const path = 'src/lib/syncSafetyPresentation.ts'
const source = fs.readFileSync(path, 'utf8')
const result = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS,target: ts.ScriptTarget.ES2020}})
const exports = {}
new Function('exports', result.outputText)(exports)
const diagnostic = exports.localSyncDiagnostic
assert.equal(typeof diagnostic, 'function')
const base = {online:true,syncing:false,pending:0,hasOutbox:false,lastSuccess:null,lastError:null}
const cases = [
  [{...base,online:false,pending:3}, 'connect', false],
  [{...base,syncing:true,pending:3}, 'wait', false],
  [{...base,lastError:'DFL_SYNC_CONFLICT'}, 'review', false],
  [{...base,lastError:'DFL_LEGACY_REVIEW'}, 'review', false],
  [{...base,lastError:'DFL_CASH_TRAIL_MISMATCH'}, 'review', false],
  [{...base,lastError:'PGRST202'}, 'review', false],
  [{...base,lastError:'network timeout'}, 'retry', true],
  [{...base,pending:2}, 'retry', true],
  [{...base,hasOutbox:true}, 'retry', true],
  [{...base,lastSuccess:'2026-10-26T10:00:00Z'}, 'none', false],
  [{...base}, 'none', false],
]
for (const [input, action, canRetry] of cases) {
  const before = JSON.stringify(input)
  const actual = diagnostic(input)
  assert.equal(actual.action,action)
  assert.equal(actual.canRetry,canRetry)
  assert.equal(JSON.stringify(input),before,'Diagnostico nao pode alterar snapshot')
}
assert.equal(diagnostic({...base,pending:NaN}).pendingCount,0)
assert.equal(diagnostic({...base,pending:-5}).pendingCount,0)
const ui = fs.readFileSync('src/components/SyncSafetyDetails.tsx','utf8')
assert.ok(ui.includes('reviewCount > 0'))
assert.ok(ui.includes('syncFailurePresentation(item.last_error)'))
const bot = fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
assert.ok(bot.length > 1000, 'Webhook real ausente')
const invariant = fs.readFileSync('src/lib/financialSyncContract.ts','utf8')
assert.ok(invariant.includes('batchIdentity') && invariant.includes('expectedSyncBase'))
console.log(`R119: ${cases.length + 5} contratos aprovados; leitura local, sem operacoes financeiras.`)
