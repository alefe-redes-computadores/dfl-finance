import fs from 'node:fs'

const read = (file) =>
  fs.readFileSync(file, 'utf8')

const ok = (condition, message) => {
  if (!condition) {
    throw new Error(`V53: ${message}`)
  }

  console.log(`OK: ${message}`)
}

const home =
  read('src/app/(app)/home/page.tsx')

const transactions =
  read('src/app/(app)/transactions/page.tsx')

const conciliation =
  read('src/app/(app)/conciliation/page.tsx')

/* HOME */

ok(
  home.includes("pendingDate > todayIso"),
  'Home continua excluindo futuro do saldo operacional'
)

ok(
  home.includes("date <= todayIso"),
  'Home preserva cutoff até hoje'
)

ok(
  home.includes(
    'actionableCount: allPending.length'
  ) &&
    home.includes(
      "router.push('/conciliation')"
    ),
  'Home expõe fila acionável e atalho de conciliação'
)

ok(
  home.includes(
    'overdueCount: allPending.filter'
  ) &&
    home.includes(
      'dueTodayCount: allPending.filter'
    ),
  'Home separa atrasadas e vencimentos de hoje'
)

/* TRANSAÇÕES */

ok(
  transactions.includes(
    "quickFilter === 'pending'"
  ) &&
    transactions.includes(
      "String(t.date || '').slice(0, 10) > todayIso"
    ),
  'Transações preserva pendências somente até hoje'
)

ok(
  transactions.includes(
    "router.push('/conciliation')"
  ) &&
    transactions.includes(
      'Revisar e conciliar'
    ),
  'Transações oferece continuação para conciliação'
)

/* CONCILIAÇÃO */

ok(
  conciliation.includes(
    'const conciliationCutoff = localIsoDate(new Date())'
  ) &&
    conciliation.includes(
      'date <= conciliationCutoff'
    ),
  'Conciliação preserva cutoff operacional'
)

ok(
  conciliation.includes(
    'if (date && date < today)'
  ) &&
    conciliation.includes(
      'if (date === today)'
    ),
  'Atraso é calculado contra hoje'
)

ok(
  !conciliation.includes(
    'currentMonth: number'
  ) &&
    !conciliation.includes(
      'pendingBreakdown.currentMonth'
    ),
  'Semântica antiga por início do mês foi removida'
)

ok(
  conciliation.includes('payableAmount') &&
    conciliation.includes('receivableAmount') &&
    conciliation.includes('formatMoney'),
  'Conciliação mostra exposição financeira'
)

console.log(
  'DFL FINANCE V53 DAILY EXPERIENCE: OK'
)
