import fs from 'node:fs'
import { execSync } from 'node:child_process'

const read = (path) => fs.readFileSync(path, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V77: ${message}`)
  console.log(`OK  ${message}`)
}

const auth = read('src/lib/hooks/useAuth.ts')
const sync = read('src/lib/syncEngine.ts')

ok(auth.includes('useSyncExternalStore'), 'auth usa store externo compartilhado')
ok(auth.includes('let initialized = false'), 'auth possui runtime singleton')
ok(auth.includes('if (initialized'), 'auth inicializa somente uma vez por aba')
ok((auth.match(/onAuthStateChange/g) || []).length === 1, 'useAuth mantém uma única assinatura de autenticação')
ok((auth.match(/\.getSession\(\)/g) || []).length === 1, 'useAuth restaura sessão uma única vez')
ok(auth.includes('readCachedUser'), 'sessão local continua disponível para boot offline')
ok(auth.includes('!window.navigator.onLine && !session && snapshot.user'), 'evento vazio offline não desloga sessão válida')

ok(sync.includes('PASSIVE_SYNC_INTERVAL_MS = 5 * 60_000'), 'pull passivo em repouso foi desacelerado')
ok(sync.includes('snapshot.pendingCount > 0'), 'fila pendente continua com tentativa rápida')
ok(sync.includes("document.addEventListener('visibilitychange'"), 'retorno ao app dispara convergência')
ok(sync.includes("window.addEventListener('online'"), 'reconexão continua disparando sincronização')
ok(sync.includes('activeSyncPromise'), 'single-flight de sincronização preservado')
ok(sync.includes('queuedForcePromise'), 'forçamento durante ciclo continua serializado')
ok(sync.includes('reconcileAccountBalancesFast'), 'reconciliação rápida V68 preservada')
ok(sync.includes('healOrphanAccountSyncStates'), 'autocura V67 preservada')
ok(sync.includes('isRetryDue(item)'), 'backoff de falhas preservado')
ok(sync.includes('skippedProtectedRemoteRows'), 'proteção de cursor V65 preservada')

const changed = execSync('git diff --name-only', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

for (const forbidden of [
  'src/lib/cardOperations.ts',
  'src/lib/debtOperations.ts',
  'src/lib/creditContractOperations.ts',
]) {
  ok(!changed.includes(forbidden), `${forbidden} não foi tocado`)
}

ok(!changed.some((path) => path.startsWith('android/')), 'Android/native intocado')

console.log('\nV77 RESILIÊNCIA + PERFORMANCE + OFFLINE — CONTRATO OK')
