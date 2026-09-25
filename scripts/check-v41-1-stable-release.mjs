import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V41.1: ${message}`)
}

const native = read('src/lib/nativeNotifications.ts')
const manager = read('src/components/NativeNotificationManager.tsx')
const center = read('src/components/NotificationCenter.tsx')
const network = read('src/components/NetworkStatus.tsx')
const layout = read('src/app/(app)/layout.tsx')
const money = read('src/components/MoneyInput.tsx')
const select = read('src/components/SelectField.tsx')
const pkg = JSON.parse(read('package.json'))

ok(native.includes('normalizeNativeNotificationRoute'), 'sanitização central de deep link ausente')
ok(native.includes("route.startsWith('//')"), 'proteção contra rota protocol-relative ausente')
ok(native.includes("route.includes('://')"), 'proteção contra URL externa ausente')
ok(native.includes("route: `/cards/details?id=${invoice.credit_card_id}`"), 'fatura sem destino contextual')
ok(native.includes("route: `/debts/details?id=${debt.id}`"), 'dívida sem destino contextual')
ok(native.includes("route: `/financings/details?id=${financing.id}`"), 'financiamento sem destino contextual')
ok(native.includes("route: `/loans/details?id=${loan.id}`"), 'empréstimo sem destino contextual')
ok(native.includes("route: `/subscriptions/details?id=${subscription.id}`"), 'assinatura sem destino contextual')
ok(native.includes("route: `/goals/details?id=${goal.id}`"), 'meta sem destino contextual')
ok(native.includes("route: `/transactions/details?id=${transaction.id}`"), 'transação sem destino contextual')

ok(manager.includes('lastNotificationRouteRef'), 'deduplicação de toque ausente')
ok(manager.includes('DFL_NOTIFICATION_ROUTE_STORAGE_KEY'), 'fila curta de deep link ausente')
ok(manager.includes('persistNotificationRoute(route)'), 'toque não é persistido antes da navegação')
ok(manager.includes('consumeNotificationRoute()'), 'replay de deep link ausente')
ok(manager.includes('router.push(route)'), 'navegação de notificação ausente')

ok(
  center.includes('`/subscriptions/details?id=${notif.subId}`'),
  'Central ainda abre assinatura em lista genérica'
)
ok(network.includes('alteração(ões) salva(s) localmente'), 'copy offline ainda presume apenas transações')

ok(layout.includes('role="status"'), 'loading global sem semântica de status')
ok(layout.includes('Carregando seus dados'), 'loading global ausente')
ok(money.includes('allowNegative?: boolean'), 'MoneyInput perdeu contrato negativo')
ok(money.includes("ariaLabel = 'Valor em reais'"), 'MoneyInput perdeu acessibilidade')
ok(select.includes('createPortal'), 'SelectField perdeu portal')
ok(select.includes('z-[1000]'), 'SelectField perdeu camada global')

ok(Boolean(pkg.dependencies?.['@capacitor/local-notifications']), 'Local Notifications ausente')
ok(!pkg.dependencies?.['@capacitor/filesystem'], 'Native Freeze furada por Filesystem')
ok(!pkg.dependencies?.['@capacitor/share'], 'Native Freeze furada por Share')

console.log('DFL FINANCE V41.1 STABLE RELEASE: OK')
