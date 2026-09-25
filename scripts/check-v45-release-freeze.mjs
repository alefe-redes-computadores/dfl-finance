import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const exists = (file) => fs.existsSync(file)
const ok = (value, message) => {
  if (!value) throw new Error(`V45: ${message}`)
}

const pkg = JSON.parse(read('package.json'))
const db = read('src/lib/db.ts')
const safeDb = read('src/lib/safeDb.ts')
const native = read('src/lib/nativeNotifications.ts')
const manager = read('src/components/NativeNotificationManager.tsx')
const statusBar = read('src/components/CapacitorStatusBar.tsx')
const network = read('src/components/NetworkStatus.tsx')
const categories = read('src/app/(app)/categories/page.tsx')
const categoryOps = read('src/lib/transactionCategoryOperations.ts')
const money = read('src/components/MoneyInput.tsx')
const select = read('src/components/SelectField.tsx')
const receipts = read('src/app/(app)/receipts/page.tsx')
const projection = read('src/hooks/useProjection.ts')
const civil = read('src/lib/civilDate.ts')

ok(pkg.name === 'dfl-finance', 'package incorreto')

for (const file of [
  'src/app/global-error.tsx',
  'src/app/offline/page.tsx',
  'src/app/(app)/error.tsx',
  'src/app/(app)/loading.tsx',
  'src/components/EmptyState.tsx',
  'src/components/Skeleton.tsx',
  'src/components/NetworkStatus.tsx',
  'src/components/NativeNotificationManager.tsx',
  'src/lib/syncEngine.ts',
  'src/lib/safeDb.ts',
  'src/lib/civilDate.ts',
]) {
  ok(exists(file), `arquivo obrigatório ausente: ${file}`)
}

ok(
  db.includes('[user_id+context+date]') &&
  db.includes('[user_id+table+record_id]'),
  'índices críticos Dexie ausentes'
)
ok(
  db.includes('revision?: number') &&
  db.includes('confirmSyncSuccessIfCurrent') &&
  db.includes('markSyncFailedIfCurrent'),
  'fila de sync perdeu proteção por revisão'
)
ok(
  safeDb.includes("sync_status: 'pending' as const") &&
  safeDb.includes('addToSyncQueue'),
  'safeDb não mantém contrato local-first'
)

ok(
  money.includes('allowNegative?: boolean') &&
  money.includes("ariaLabel = 'Valor em reais'") &&
  money.includes("inputMode={allowNegative ? 'text' : 'numeric'}"),
  'MoneyInput perdeu contrato estável'
)
ok(
  select.includes('createPortal') &&
  select.includes('icon?: ReactNode') &&
  select.includes('z-[1000]'),
  'SelectField perdeu portal/ícones/camada global'
)

ok(
  categoryOps.includes('category.is_archived === true') &&
  categories.includes('Categorias ocultas') &&
  categories.includes('restoreCategory'),
  'categorias ocultáveis/restauráveis incompletas'
)

ok(
  projection.includes('positiveDailySamples') &&
  projection.includes('dailyCap') &&
  projection.includes('cappedDays'),
  'projeção robusta V36 ausente'
)

ok(
  receipts.includes('ReceiptViewer') &&
  receipts.includes('getReceiptStoragePath') &&
  receipts.includes('10 * 1024 * 1024'),
  'Central de Comprovantes perdeu contrato final'
)

ok(
  native.includes("managedBy: 'dfl-finance'") &&
  native.includes("route: `/cards/details?id=${invoice.credit_card_id}`") &&
  native.includes("route: `/debts/details?id=${debt.id}`") &&
  native.includes("route: `/financings/details?id=${financing.id}`") &&
  native.includes("route: `/loans/details?id=${loan.id}`") &&
  native.includes("route: `/subscriptions/details?id=${subscription.id}`") &&
  native.includes("route: `/goals/details?id=${goal.id}`") &&
  native.includes("route: `/transactions/details?id=${transaction.id}`"),
  'deep links contextuais de notificação incompletos'
)
ok(
  /useEffect\(\(\)\s*=>\s*\{[\s\S]{0,1800}?consumeNotificationRoute\(\)/.test(manager),
  'replay real do deep link de notificação ausente'
)
ok(
  manager.includes('lastNotificationRouteRef') &&
  manager.includes('persistNotificationRoute(route)'),
  'deduplicação/persistência de toque ausentes'
)

ok(
  statusBar.includes("registerPlugin<SystemBarsPlugin>('SystemBars')") &&
  statusBar.includes("SystemBars.setTheme({ dark: theme === 'dark' })"),
  'ponte SystemBars Android ausente'
)

ok(
  network.includes('alteração(ões) salva(s) localmente'),
  'copy offline genérica ausente'
)

ok(
  civil.includes('localISODate') &&
  civil.includes('parseCivilDate') &&
  civil.includes('toLocalCivilDate'),
  'proteção de data civil ausente'
)

ok(Boolean(pkg.dependencies?.['@capacitor/local-notifications']), 'Local Notifications ausente')
ok(Boolean(pkg.dependencies?.['@capacitor/browser']), 'Capacitor Browser ausente')
ok(!pkg.dependencies?.['@capacitor/filesystem'], 'Native Freeze furado por Filesystem')
ok(!pkg.dependencies?.['@capacitor/share'], 'Native Freeze furado por Share')

console.log('DFL FINANCE V45 RELEASE FREEZE CONTRACT: OK')
