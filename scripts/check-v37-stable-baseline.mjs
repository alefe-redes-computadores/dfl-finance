import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V37: ${message}`)
}

const money = read('src/components/MoneyInput.tsx')
const accounts = read('src/app/(app)/accounts/details/page.tsx')
const native = read('src/lib/nativeNotifications.ts')
const manager = read('src/components/NativeNotificationManager.tsx')
const pkg = JSON.parse(read('package.json'))

ok(money.includes('allowNegative?: boolean'), 'MoneyInput sem contrato negativo')
ok(money.includes("ariaLabel = 'Valor em reais'"), 'MoneyInput sem acessibilidade básica')
ok(accounts.includes('ariaLabel="Valor do ajuste de saldo"'), 'ajuste de saldo não usa MoneyInput')
ok(accounts.includes('ariaLabel="Valor da transferência"'), 'transferência não usa MoneyInput')
ok(!accounts.includes('type="number"\\n                    step="0.01"'), 'campo monetário bruto persistiu em contas')

ok(native.includes("db.goals.where('user_id')"), 'metas não entram no scheduler')
ok(native.includes("key: `goal:${goal.id}`"), 'candidato de meta ausente')
ok(native.includes("route: `/goals/details?id=${goal.id}`"), 'meta não abre ação contextual')
ok(native.includes("route: `/subscriptions/details?id=${subscription.id}`"), 'assinatura ainda abre lista genérica')
ok(native.includes("route: `/cards/details?id=${invoice.credit_card_id}`"), 'fatura perdeu deep link')
ok(native.includes("route: `/debts/details?id=${debt.id}`"), 'dívida perdeu deep link')
ok(native.includes("route: `/financings/details?id=${financing.id}`"), 'financiamento perdeu deep link')
ok(native.includes("route: `/loans/details?id=${loan.id}`"), 'empréstimo perdeu deep link')
ok(native.includes("route: `/transactions/details?id=${transaction.id}`"), 'transação perdeu deep link')
ok(native.includes("!route.includes('://')"), 'sanitização de rota interna ausente')
ok(manager.includes('lastNotificationRouteRef'), 'proteção contra toque duplicado ausente')
ok(manager.includes('router.push(route)'), 'ação da notificação não navega ao destino')

ok(Boolean(pkg.dependencies?.['@capacitor/local-notifications']), 'plugin de notificação ausente')
ok(Boolean(pkg.dependencies?.['@capacitor/browser']), 'Browser esperado ausente')
ok(!pkg.dependencies?.['@capacitor/filesystem'], 'Native Freeze furada por Filesystem')
ok(!pkg.dependencies?.['@capacitor/share'], 'Native Freeze furada por Share')

console.log('DFL FINANCE V37 STABLE BASELINE: OK')
