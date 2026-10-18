import fs from 'node:fs'
import assert from 'node:assert/strict'
const read=f=>fs.readFileSync(f,'utf8')
const home=read('src/app/(app)/home/page.tsx')
const hook=read('src/hooks/useLocalSync.ts')
const workflow=read('.github/workflows/android-build.yml')
const sync=read('src/lib/syncEngine.ts')
const inbox=read('src/lib/inboxPolicy.ts')
const bank=read('src/lib/financialSyncContract.ts')
const checks=[
  ['Home usa sync sem toast verde automatico',home.includes('forceSync({ silentSuccess: true })')],
  ['Refresh manual ainda pede feedback',home.includes('const result = await forceSync()')],
  ['Falhas da Home continuam visiveis',home.includes('hasSyncFailure')&&home.includes("'error'")],
  ['Toast lento so depois de 10 segundos',home.includes('10_000')&&home.includes('showToast')],
  ['Hook suporta silencio somente de sucesso',hook.includes('options?: { silentSuccess?: boolean }')&&hook.includes('result.success && !options?.silentSuccess')],
  ['Hook nunca suprime feedback das falhas',hook.includes('result.pullFailedTables.length > 0')&&hook.includes('syncFailurePresentation(first.lastError)')],
  ['Sync usa snapshot unico',hook.includes('useSyncExternalStore(')],
  ['Motor tem protecao de fila concorrente',sync.includes('protectedNow')&&sync.includes('db.transaction(')],
  ['Inbox WhatsApp exige revisao',inbox.includes("'whatsapp'")&&inbox.includes('needsFinancialReview')],
  ['Contrato financeiro idempotente preservado',bank.includes('batchIdentity')&&bank.includes('financialOperationId')],
  ['Workflow possui suite financeira isolada',workflow.includes('scripts/check-v84-financial-sql.mjs')],
  ['Workflow protege contratos do bot',workflow.includes('scripts/check-v163-bot-release.mjs')],
  ['Workflow protege UX',workflow.includes('scripts/check-v160-ui.cjs')],
  ['Workflow testa offline e concorrencia',workflow.includes('scripts/jest-financial.cjs')],
  ['Workflow testa V163 app',workflow.includes('scripts/check-v163-app-release.mjs')],
  ['Workflow preserva assinatura estavel',workflow.includes('DFL_FINANCE_STABLE_SIGNING_V1')],
  ['Workflow preserva edge-to-edge',workflow.includes('patch-android-system-bars-v15.mjs')],
  ['APK fica disponivel por 14 dias',workflow.includes('retention-days: 14')],
  ['APK nao e implantado automaticamente',!workflow.includes('gradlew publish')&&!workflow.includes('play-store')],
]
for(const [label,condition] of checks){console.log((condition?'OK':'FALHOU')+': '+label);assert.ok(condition,label)}
console.log('V163 APP/APK: 19 contratos aprovados')
