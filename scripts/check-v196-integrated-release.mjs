import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

let count = 0
const read = p => fs.readFileSync(p, 'utf8')

function check(name, fn) {
  fn()
  count++
  console.log('✓', name)
}

const paths = {
  home: 'src/app/(app)/home/page.tsx',
  transactions: 'src/app/(app)/transactions/page.tsx',
  dashboard: 'src/hooks/useDashboardMetrics.ts',
  transactionHook: 'src/hooks/useTransactionsList.ts',
  local: 'src/hooks/useLocalData.ts',
  sync: 'src/lib/syncEngine.ts',
  nav: 'src/components/BottomNav.tsx',
  workflow: '.github/workflows/android-build.yml'
}

for (const [name, path] of Object.entries(paths)) {
  check(`Arquivo ${name} presente`, () => {
    assert.ok(fs.existsSync(path), path)
  })
}

for (const name of [
  'home', 'transactions', 'dashboard',
  'transactionHook', 'local', 'nav'
]) {
  check(`Sintaxe ${name}`, () => {
    const path = paths[name]
    const parsed = ts.createSourceFile(
      path, read(path), ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx')
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS
    )
    assert.equal(parsed.parseDiagnostics.length, 0)
  })
}

const tx = read(paths.transactions)
const home = read(paths.home)
const dash = read(paths.dashboard)
const hook = read(paths.transactionHook)
const local = read(paths.local)
const sync = read(paths.sync)
const nav = read(paths.nav)
const workflow = read(paths.workflow)

check('Home preserva sincronizacao', () => {
  assert.ok(home.includes('forceSync'))
})

check('Home preserva alerta de falhas', () => {
  assert.ok(home.includes('hasSyncFailure'))
})

check('Home nao confirma sync automaticamente', () => {
  assert.ok(home.includes('silentSuccess: true'))
})

check('Transacoes possuem busca diferida', () => {
  assert.ok(tx.includes('useDeferredValue(search)'))
})

check('Busca imediata permanece controlada', () => {
  assert.ok(tx.includes('value={search}'))
})

check('Transacoes preservam categorias', () => {
  assert.ok(tx.includes('effectiveCategoryFilter'))
})

check('Transacoes preservam filtro de conta', () => {
  assert.ok(tx.includes('advFilters.accountId'))
})

check('Pendencias usam janela temporal', () => {
  assert.ok(tx.includes('todayIso'))
  assert.ok(tx.includes('const pendingSummaryTxs = useMemo('))
})

check('Pendencias classificadas separadamente', () => {
  assert.ok(tx.includes('getPendingDirection(tx)'))
  assert.ok(tx.includes('isStandalonePendingReceivable(tx)'))
})

check('Totais preservam valores de dividas', () => {
  assert.ok(tx.includes('safeNum(debt.remaining)'))
})

check('Transferencias preservam agrupamento', () => {
  assert.ok(tx.includes('transfer_group_id'))
  assert.ok(tx.includes('transaction._transferView'))
})

check('Cards preservam atualizacoes de dados', () => {
  assert.ok(tx.includes('React.memo(TransactionItem)'))
  assert.ok(!tx.includes('React.memo(TransactionItem,'))
})

check('Listas preservam ordem por data', () => {
  assert.ok(tx.includes('const sortedDates = useMemo('))
})

check('Transacoes preservam exportacao', () => {
  assert.ok(tx.includes('exportTransactionsToCSV'))
})

check('Dashboard preserva contexto PF PJ', () => {
  assert.ok(dash.includes("'personal'"))
  assert.ok(dash.includes("'dfl'"))
})

check('Dashboard protege requisicoes atrasadas', () => {
  assert.ok(dash.includes('requestVersionRef'))
  assert.ok(dash.includes('isCurrentRequest()'))
})

check('Dashboard usa historico limitado', () => {
  assert.ok(dash.includes('[user_id+date]'))
})

check('Consultas preservam usuario ativo', () => {
  assert.ok(hook.includes('user.id'))
  assert.ok(local.includes('user.id'))
})

check('Consultas usam resultados estaveis', () => {
  assert.ok(hook.includes('stableLocalRows'))
  assert.ok(local.includes('stableLocalRows'))
})

check('Sincronizacao possui protecao financeira', () => {
  assert.ok(sync.includes('protectedNow'))
  assert.ok(sync.includes('db.transaction('))
})

check('Botao central abre formulario completo', () => {
  assert.ok(nav.includes(
    "navigateSafely('/transactions/new')"
  ))
})

check('Navegacao sem reload forçado', () => {
  assert.ok(!nav.includes('window.location.assign(path)'))
})

check('Workflow mantem assinatura Android', () => {
  assert.ok(workflow.includes(
    'DFL_FINANCE_STABLE_SIGNING_V1'
  ))
})

check('Workflow preserva edge-to-edge', () => {
  assert.ok(workflow.includes(
    'patch-android-system-bars-v15.mjs'
  ))
})

check('Workflow executa gate V196', () => {
  assert.ok(workflow.includes(
    'node scripts/check-v196-integrated-release.mjs'
  ))
})

console.log(`V196: ${count} contratos integrados aprovados.`)
