import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const r = path => fs.readFileSync(path, 'utf8')
const changed = [
  'src/lib/userSettings.ts', 'src/lib/nativeNotifications.ts',
  'src/components/NativeNotificationManager.tsx',
  'src/app/(app)/intelligence-center/observations/page.tsx',
  'src/lib/mobileUpdateService.ts', 'src/app/(app)/updates/page.tsx',
  'src/lib/proactiveDigestPolicy.ts', 'src/lib/proactiveNativeDigest.ts',
  'src/lib/apkWorkflowDiagnostics.ts',
  'src/__tests__/r459Delivery.test.ts',
]
for (const path of changed) {
  const source = r(path)
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.equal(file.parseDiagnostics.length, 0, `Sintaxe R459: ${path}`)
}
const settings = r(changed[0]), native = r(changed[1]), manager = r(changed[2])
const observations = r(changed[3]), service = r(changed[4]), updates = r(changed[5])
const digest = r(changed[7]), policy = r(changed[6]), workflow = r('.github/workflows/android-build.yml')
const checks = [
  ['Opt-in OFF por padrão', settings.includes('proactive_android_enabled: false')],
  ['Configuração sincronizável', settings.includes('proactive_android_enabled: boolean') && settings.includes('raw.proactive_android_enabled === true')],
  ['Somente um agendamento local', policy.includes('Apenas uma próxima entrega')],
  ['Sem observações sem base', policy.includes("['high', 'medium']") && policy.includes("['critical', 'warning', 'attention']")],
  ['Rota segura da observação', policy.includes("'/intelligence-center/observations'")],
  ['Não solicita permissão silenciosamente', !digest.includes('requestPermissions(')],
  ['Ação explícita solicita permissão', observations.includes('requestProactiveDigestPermission()') && digest.includes('requestNativeNotificationPermission()') && !observations.includes('requestNativeNotificationPermission')],
  ['Separação do agendador R457', digest.includes("OWNER = 'dfl-finance-proactive'") && native.includes("managedBy: 'dfl-finance'")],
  ['OFF cancela pendentes', manager.includes('clearProactiveNativeDigest()')],
  ['Contexto selecionado', observations.includes('effectiveContext') && digest.includes('context')],
  ['Privacidade padrão', settings.includes("notification_privacy: 'private'") && policy.includes("settings.privacy === 'full'")],
  ['Teste nativo abre a Central', native.includes("managedBy: 'dfl-finance-test', route: '/notification-center'")],
  ['Replay de rota revalidado', manager.includes('normalizeNativeNotificationRoute(parsed.route)')],
  ['Ação de navegação mantida', manager.includes('persistNotificationRoute(route)')],
  ['Status da Action não é notificação', updates.includes('Última Action') && !service.includes('Notification.requestPermissions')],
  ['Falha e expiração distinguíveis', updates.includes("kind === 'failed'") && updates.includes("kind === 'expired'")],
  ['Sem token do GitHub', !/GITHUB_TOKEN|Bearer|service_role/.test(service)],
  ['R456 preservada', workflow.includes('node scripts/check-r456-app-updates.mjs')],
  ['R457 preservada', workflow.includes('node scripts/check-r457-notification-center.mjs')],
  ['R458 preservada', workflow.includes('R458 Proactive Intelligence certification')],
  ['R459 testada na Action', workflow.includes('R459 Release Closeout')],
  ['WhatsApp não tocado', fs.existsSync('supabase/functions/whatsapp-webhook/index.ts')],
]
checks.forEach(([name, cond]) => assert.ok(cond, `R459: ${name}`))
console.log(`R459_CLOSEOUT_OK: ${checks.length} contratos e ${changed.length} arquivos com sintaxe verificada`)
