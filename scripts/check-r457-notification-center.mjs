import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read = file => fs.readFileSync(file, 'utf8')
const native = read('src/lib/nativeNotifications.ts')
const settings = read('src/lib/userSettings.ts')
const rules = read('src/lib/nativeNotificationRules.ts')
const page = read('src/app/(app)/notification-center/page.tsx')
const legacy = read('src/components/NotificationPreferencesCard.tsx')
const notifications = read('src/app/(app)/notifications/page.tsx')
const more = read('src/app/(app)/more/page.tsx')
const workflow = read('.github/workflows/android-build.yml')
const packageJson = JSON.parse(read('package.json'))

for (const path of [
  'src/lib/nativeNotificationRules.ts', 'src/lib/nativeNotifications.ts',
  'src/lib/userSettings.ts', 'src/app/(app)/notification-center/page.tsx',
  'src/__tests__/nativeNotificationRules.test.ts',
]) {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.equal(source.parseDiagnostics.length, 0, `TS sintaxe inválida: ${path}`)
}
assert(packageJson.dependencies?.['@capacitor/local-notifications'], 'Plugin nativo não instalado')
assert(native.includes('LocalNotifications.checkPermissions()'), 'Permissão não consultada')
assert(native.includes('LocalNotifications.requestPermissions()'), 'Pedido explícito ausente')
assert(native.includes("DFL_NOTIFICATION_CHANNEL_ID = 'dfl-financial-alerts'"), 'Canal legado perdido')
assert(native.includes("DFL_NOTIFICATION_PRIVATE_CHANNEL_ID = 'dfl-financial-private-v1'"), 'Canal privado novo ausente')
assert(native.includes('visibility: 0'), 'Tela bloqueada pública')
assert(native.includes("preferences.notification_privacy !== 'full'"), 'Privacidade não respeitada')
assert(native.includes('const cancelled = await cancelManagedNotifications()'), 'OFF não cancela agenda')
assert(native.includes('const current = await LocalNotifications.getPending()'), 'Reconciliador sem pending')
assert(native.includes('sameScheduledReminder'), 'Reagendamento integral pode ocorrer')
assert(native.includes('stale.map(item => ({ id: item.id }))'), 'Cancelamento não seletivo')
assert(native.includes('notifications: needed'), 'Agendamento sem diff')
assert(native.includes('stableNotificationId(`${userId}:${key}`)'), 'Agenda não isola conta')
assert(native.includes('notifications.length >= 60'), 'Capacidade Android não protegida')
assert(native.includes('groupSummary: true') && native.includes("route: '/notifications'"), 'Agrupamento legado perdido')
assert(native.includes('normalizeNativeNotificationRoute('), 'Roteamento seguro perdido')
assert(!/conciliatePendingTransaction\(|applyAccountCashDelta\(/.test(native), 'Proibido alterar saldo')
assert(settings.includes('notification_rules: normalizeNotificationRules(raw.notification_rules)'), 'Persistência sem normalização')
assert(settings.includes("notification_privacy: raw.notification_privacy === 'full' ? 'full' : 'private'"), 'Default privado ausente')
assert(settings.includes(".from('user_settings').upsert"), 'Preferências não chegam ao Supabase')
assert(rules.includes('reminderOccurrences(') && rules.includes('overdueMaxDays'), 'Recorrência diária não controlada')
assert(page.includes('requestNativeNotificationPermission()') && page.includes('notification_onboarding_done'), 'Onboarding sem consentimento')
assert(page.includes('notification_categories') && page.includes('notification_rules'), 'Categorias não configuráveis')
assert(page.includes('notification_privacy') && page.includes('minimumAmount'), 'Privacy/threshold não configuráveis')
assert(page.includes('TestTube2') && page.includes('sendNativeNotificationTest()'), 'Teste nativo ausente')
assert(!/[\u{1F300}-\u{1FAFF}]/u.test(page), 'UI contém emoji em vez de Lucide')
assert(legacy.includes('notification_lead_days') && legacy.includes('notification_overdue'), 'Preferências legadas quebradas')
assert(notifications.includes('<NotificationPreferencesCard />') && notifications.includes('archiveNotificationIds'), 'Histórico alterado')
assert(more.includes('label="Central de Notificações" href="/notifications"'), 'Menu legado perdido')
assert(more.includes('href="/notification-center"'), 'Central nova não navegável')
assert(workflow.includes('check-r457-notification-center.mjs'), 'Android sem gate R457')
console.log('R457_NOTIFICATION_CENTER_OK: 35 contratos premium, Android, persistência, privacidade, OFF e regressão')
