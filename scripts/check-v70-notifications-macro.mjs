import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')

const ok = (value, message) => {
  if (!value) {
    throw new Error(`V70: ${message}`)
  }
}

const home = read('src/app/(app)/home/page.tsx')
const more = read('src/app/(app)/more/page.tsx')
const page = read('src/app/(app)/notifications/page.tsx')

const preferences = read(
  'src/components/NotificationPreferencesCard.tsx'
)

const native = read('src/lib/nativeNotifications.ts')

const manager = read(
  'src/components/NativeNotificationManager.tsx'
)

ok(
  home.includes(
    'notificationSettings?.preferences.push_notifications ?? false'
  ),
  'Home não usa a preferência oficial de notificações'
)

ok(
  !home.includes(
    "localStorage.getItem('dfl_notifications_enabled')"
  ),
  'Home ainda possui segunda verdade legada'
)

ok(
  home.includes('<NotificationBell'),
  'Home perdeu o sino de notificações'
)

ok(
  home.includes('<NotificationCenter'),
  'Home perdeu a Central modal'
)

ok(
  more.includes(
    'label="Central de Notificações" href="/notifications"'
  ),
  'Mais não possui acesso direto à Central'
)

ok(
  page.includes('<NotificationPreferencesCard />'),
  'Central não incorporou as preferências'
)

const requiredPreferencesContracts = [
  'useHapticFeedback',
  'useToast',
  'Bell',
  'CalendarClock',
  'TestTube2',
  'notification_lead_days',
  'notification_hour',
  'notification_overdue',
  'notification_categories',
]

for (const contract of requiredPreferencesContracts) {
  ok(
    preferences.includes(contract),
    `painel de preferências incompleto: ${contract}`
  )
}

ok(
  !/[\u{1F300}-\u{1FAFF}]/u.test(preferences),
  'emoji encontrado na nova interface'
)

ok(
  native.includes(
    "DFL_NOTIFICATION_CHANNEL_ID = 'dfl-financial-alerts'"
  ),
  'canal Android foi perdido'
)

ok(
  native.includes('syncNativeFinancialReminders'),
  'scheduler financeiro foi perdido'
)

ok(
  native.includes('LocalNotifications.schedule'),
  'agendamento nativo foi perdido'
)

ok(
  native.includes('LocalNotifications.cancel'),
  'cancelamento nativo foi perdido'
)

ok(
  manager.includes('lastNotificationRouteRef'),
  'proteção de deep-link foi perdida'
)

ok(
  manager.includes('persistNotificationRoute(route)'),
  'persistência do deep-link foi perdida'
)

ok(
  manager.includes('consumeNotificationRoute()'),
  'replay do deep-link foi perdido'
)

ok(
  page.includes('archiveNotificationIds'),
  'arquivamento histórico da Central foi perdido'
)

ok(
  page.includes('clearAllNotifications'),
  'limpeza histórica da Central foi perdida'
)

ok(
  page.includes('markAllAsRead'),
  'leitura em lote foi perdida'
)

console.log(
  'V70 macro notifications contract: OK'
)
