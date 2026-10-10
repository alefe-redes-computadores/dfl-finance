// src/lib/syncEngine.ts
'use client'

import { liveQuery } from 'dexie'
import { pushAtomicFinancialBatch } from '@/lib/atomicFinancialSync'
import { remoteSyncBase } from '@/lib/financialSyncContract'
import { fetchRemoteSyncRows } from '@/lib/remoteSyncPages'
import {
  confirmSyncSuccessIfCurrent,
  db,
  getPendingSyncItems,
  markSyncFailedIfCurrent,
  type LocalSyncQueue,
} from '@/lib/db'
import { supabase } from '@/lib/supabase'

export const SYNC_TABLES = [
  'transactions',
  'accounts',
  'categories',
  'credit_cards',
  'debts',
  'loans',
  'financings',
  'subscriptions',
  'tags',
  'contacts',
  'budgets',
  'goals',
  'credit_invoices',
  'notifications',
] as const

export type SyncTableName = (typeof SYNC_TABLES)[number]
export type SyncStatus = 'idle' | 'syncing' | 'online' | 'offline'

export type SyncCycleResult = {
  success: boolean
  pushFailures: number
  pendingCount: number
  pullSuccess: boolean
  pullFailedTables: SyncTableName[]
}

export type SyncQueueDiagnostic = {
  id: string
  table: LocalSyncQueue['table']
  operation: LocalSyncQueue['operation']
  recordId: string
  attempts: number
  lastError: string | null
  lastAttemptAt: string | null
}

type PullResult = {
  success: boolean
  failedTables: SyncTableName[]
}

type SyncSnapshot = {
  syncStatus: SyncStatus
  isOnline: boolean
  pendingCount: number
  hasFinancialOutbox: boolean
  isSyncing: boolean
  isBalanceReconciling: boolean
  balanceVerifiedAt: string | null
  lastSuccessfulSyncAt: string | null
  lastSyncError: string | null
}

const SERVER_SNAPSHOT: SyncSnapshot = {
  syncStatus: 'idle',
  isOnline: true,
  pendingCount: 0,
  hasFinancialOutbox: false,
  isSyncing: false,
  isBalanceReconciling: false,
  balanceVerifiedAt: null,
  lastSuccessfulSyncAt: null,
  lastSyncError: null,
}

let snapshot: SyncSnapshot = {
  ...SERVER_SNAPSHOT,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
}

const listeners = new Set<() => void>()

let currentUserId: string | null = null
let runtimeInitialized = false
let pendingSubscription: { unsubscribe: () => void } | null = null
let activeSyncPromise: Promise<SyncCycleResult> | null = null
let queuedForcePromise: Promise<SyncCycleResult> | null = null
let periodicSyncTimer: ReturnType<typeof setInterval> | null = null
let lastPassiveSyncAt = 0

const PASSIVE_SYNC_INTERVAL_MS = 5 * 60_000

function emit() {
  listeners.forEach(
    (listener) => {
      listener()
    }
  )
}

function setSnapshot(patch: Partial<SyncSnapshot>) {
  const next = { ...snapshot, ...patch }

  if (
    next.syncStatus === snapshot.syncStatus &&
    next.isOnline === snapshot.isOnline &&
    next.pendingCount === snapshot.pendingCount &&
    next.isSyncing === snapshot.isSyncing &&
    next.isBalanceReconciling === snapshot.isBalanceReconciling &&
    next.balanceVerifiedAt === snapshot.balanceVerifiedAt
  ) {
    return
  }

  snapshot = next
  emit()
}

function renderLog(
  msg: string,
  type: 'info' | 'error' | 'success' = 'info'
) {
  if (typeof window === 'undefined') return

  try {
    window.dispatchEvent(
      new CustomEvent('admin-log', {
        detail: {
          msg,
          type,
          timestamp: new Date().toISOString(),
        },
      })
    )
  } catch {
    // Diagnóstico não deve interferir no motor de sincronização.
  }
}

function ensureRuntime() {
  if (runtimeInitialized || typeof window === 'undefined') return

  runtimeInitialized = true

  const handleOnline = () => {
    setSnapshot({
      isOnline: true,
      syncStatus: snapshot.isSyncing ? 'syncing' : 'online',
    })
    renderLog('Conexão restabelecida.', 'success')
    void processSyncQueue(false)
  }

  const handleOffline = () => {
    setSnapshot({
      isOnline: false,
      syncStatus: 'offline',
    })
    renderLog('Dispositivo offline.', 'error')
  }

  const handleVisibilityChange = () => {
    if (
      document.visibilityState !== 'visible' ||
      !currentUserId ||
      !snapshot.isOnline
    ) {
      return
    }

    /*
     * Ao voltar ao app, buscamos mudanças remotas sem esperar o relógio
     * periódico. O single-flight existente impede ciclos concorrentes.
     */
    lastPassiveSyncAt = Date.now()
    void processSyncQueue(false)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  document.addEventListener('visibilitychange', handleVisibilityChange)

  periodicSyncTimer = setInterval(() => {
    if (!currentUserId || !snapshot.isOnline || document.visibilityState !== 'visible') return

    /*
     * Fila local pendente continua recebendo oportunidade a cada minuto.
     * Sem fila, o pull passivo cai para 5 minutos. Isso reduz consultas
     * remotas em repouso sem sacrificar retomada, foco ou sincronização manual.
     */
    if (snapshot.pendingCount > 0) {
      void processSyncQueue(false)
      return
    }

    const now = Date.now()
    if (now - lastPassiveSyncAt < PASSIVE_SYNC_INTERVAL_MS) return

    lastPassiveSyncAt = now
    void processSyncQueue(false)
  }, 60_000)
}

function watchPendingCount(userId: string | null) {
  pendingSubscription?.unsubscribe()
  pendingSubscription = null

  if (!userId) {
    setSnapshot({ pendingCount: 0, hasFinancialOutbox: false })
    return
  }

  pendingSubscription = liveQuery(async () => {
    const [count, outbox] = await Promise.all([db.syncQueue.where('user_id').equals(userId).count(), db.financialOutbox.get(userId)])
    return { count, hasOutbox: Boolean(outbox) }
  }).subscribe({
    next: ({ count, hasOutbox }) => {
      if (currentUserId === userId) {
        setSnapshot({ pendingCount: count, hasFinancialOutbox: hasOutbox })
      }
    },
    error: (error) => {
      console.error('[SYNC] Falha ao observar fila local:', error)
    },
  })
}

export function configureSyncEngine(userId: string | null) {
  ensureRuntime()

  const online =
    typeof navigator !== 'undefined' ? navigator.onLine : snapshot.isOnline

  setSnapshot({
    isOnline: online,
    syncStatus: snapshot.isSyncing
      ? 'syncing'
      : online
        ? 'online'
        : 'offline',
  })

  if (currentUserId === userId) {
    return
  }

  currentUserId = userId
  setSnapshot({ lastSuccessfulSyncAt: null, lastSyncError: null, balanceVerifiedAt: null, pendingCount: 0, hasFinancialOutbox: false })
  watchPendingCount(userId)

  if (userId && online) {
    lastPassiveSyncAt = Date.now()

    /*
     * V68 — saldo é dado crítico de abertura.
     * Reconciliamos somente accounts primeiro; o sync completo continua
     * em seguida, sem bloquear a Home esperando todas as tabelas.
     */
    void reconcileAccountBalancesFast(userId)
      .finally(() => {
        void processSyncQueue(false)
      })
  }
}

export function subscribeSyncSnapshot(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSyncSnapshot() {
  return snapshot
}

export function getServerSyncSnapshot() {
  return SERVER_SNAPSHOT
}

export async function refreshPendingCount(userId = currentUserId) {
  if (!userId) {
    if (!currentUserId) {
      setSnapshot({ pendingCount: 0, hasFinancialOutbox: false })
    }
    return 0
  }

  const count = await db.syncQueue.where('user_id').equals(userId).count()

  if (currentUserId === userId) {
    setSnapshot({ pendingCount: count })
  }

  return count
}

export async function getSyncQueueDiagnostics(
  userId = currentUserId
): Promise<SyncQueueDiagnostic[]> {
  if (!userId) return []

  const items = await getPendingSyncItems(userId)

  return items.map((item) => ({
    id: item.id,
    table: item.table,
    operation: item.operation,
    recordId: item.record_id,
    attempts: item.attempts || 0,
    lastError: item.last_error || null,
    lastAttemptAt: item.last_attempt_at || null,
  }))
}


function retryDelayMs(attempts: number) {
  if (attempts <= 0) return 0
  if (attempts === 1) return 30_000
  if (attempts === 2) return 60_000
  if (attempts === 3) return 2 * 60_000
  if (attempts === 4) return 5 * 60_000
  if (attempts === 5) return 15 * 60_000
  return 30 * 60_000
}

function isRetryDue(item: LocalSyncQueue) {
  const attempts = item.attempts || 0

  if (attempts === 0 || !item.last_attempt_at) {
    return true
  }

  const lastAttemptAt = Date.parse(item.last_attempt_at)

  if (!Number.isFinite(lastAttemptAt)) {
    return true
  }

  return Date.now() - lastAttemptAt >= retryDelayMs(attempts)
}

export async function reconcileAccountBalancesFast(
  userId = currentUserId
): Promise<boolean> {
  if (!userId || !snapshot.isOnline) {
    return false
  }

  setSnapshot({ isBalanceReconciling: true })

  try {
    const [localAccounts, queueItems] = await Promise.all([
      db.accounts.where('user_id').equals(userId).toArray(),
      db.syncQueue.where('user_id').equals(userId).toArray(),
    ])

    const protectedAccountIds = new Set(
      queueItems
        .filter((item) => item.table === 'accounts')
        .map((item) => item.record_id)
    )

    const remoteAccounts = await fetchRemoteSyncRows('accounts', userId)
    if (currentUserId !== userId) return false
    const remoteIds = new Set(
      remoteAccounts
        .map((item: any) => item?.id)
        .filter((id: any): id is string => typeof id === 'string')
    )

    await db.transaction('rw', db.accounts, db.syncQueue, async () => {
      for (const remoteAccount of remoteAccounts) {
        const activeQueue = await db.syncQueue
          .where('user_id')
          .equals(userId)
          .filter(
            (item) =>
              item.table === 'accounts' &&
              item.record_id === remoteAccount.id
          )
          .first()

        if (activeQueue) continue

        await db.accounts.put({
          ...remoteAccount,
          _sync_base: remoteSyncBase(remoteAccount),
          balance:
            Math.round(Number(remoteAccount.balance ?? 0) * 100) / 100,
          sync_status: 'synced',
          sync_attempts: 0,
          last_sync_error: null,
        })
      }

      const currentAccountQueue = await db.syncQueue.where('user_id').equals(userId).filter(item => item.table === 'accounts').toArray()
      const currentlyProtected = new Set(currentAccountQueue.map(item => item.record_id))
      const staleIds = localAccounts
        .filter(
          (account: any) =>
            account?.id &&
            account.sync_status === 'synced' &&
            !remoteIds.has(account.id) &&
            !protectedAccountIds.has(account.id) && !currentlyProtected.has(account.id)
        )
        .map((account: any) => account.id)

      if (staleIds.length > 0) {
        await db.accounts.bulkDelete(staleIds)
      }
    })

    const verifiedAt = new Date().toISOString()
    const stillProtected = await db.syncQueue.where('user_id').equals(userId).filter(item => item.table === 'accounts').count()
    setSnapshot({ balanceVerifiedAt: stillProtected ? null : verifiedAt })
    renderLog('Saldos das contas reconciliados com prioridade.', 'success')
    return true
  } catch (error: any) {
    renderLog(
      `Reconciliação prioritária de saldo falhou: ${error?.message || 'erro desconhecido'}`,
      'error'
    )
    return false
  } finally {
    setSnapshot({ isBalanceReconciling: false })
  }
}

async function healOrphanAccountSyncStates(
  userId: string
): Promise<number> {
  /*
   * V67 — autocura explícita de contas órfãs.
   *
   * Um registro pending/failed sem item correspondente na syncQueue
   * não possui mutação local enviável. Nesse estado, o snapshot remoto
   * é a única versão sincronizável e deve restaurar a convergência.
   *
   * A leitura remota é restrita ao usuário autenticado e a escrita
   * ocorre somente no Dexie local. Nenhum saldo é recalculado.
   */
  const [localAccounts, queueItems] = await Promise.all([
    db.accounts
      .where('user_id')
      .equals(userId)
      .toArray(),
    db.syncQueue
      .where('user_id')
      .equals(userId)
      .toArray(),
  ])

  const queuedAccountIds = new Set(
    queueItems
      .filter((item) => item.table === 'accounts')
      .map((item) => item.record_id)
  )

  const outbox = await db.financialOutbox.get(userId)
  for (const item of outbox?.queue ?? []) if (item.table === 'accounts') queuedAccountIds.add(item.record_id)

  const orphanIds = localAccounts
    .filter(
      (account: any) =>
        (account.sync_status === 'pending' ||
          account.sync_status === 'failed') &&
        !queuedAccountIds.has(account.id)
    )
    .map((account: any) => account.id)
    .filter(Boolean)

  if (orphanIds.length === 0) {
    return 0
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .in('id', orphanIds)

  if (error) {
    throw new Error(
      `Falha ao recuperar contas órfãs: ${error.message}`
    )
  }

  if (currentUserId !== userId) return 0
  const remoteAccounts = data ?? []

  if (remoteAccounts.length === 0) {
    return 0
  }

  await db.transaction(
    'rw',
    db.accounts,
    db.syncQueue,
    async () => {
      for (const remoteAccount of remoteAccounts) {
        /*
         * Revalida dentro da transação: uma edição legítima pode ter
         * criado fila entre a leitura inicial e a aplicação da cura.
         */
        const activeQueue = await db.syncQueue
          .where('user_id')
          .equals(userId)
          .filter(
            (item) =>
              item.table === 'accounts' &&
              item.record_id === remoteAccount.id
          )
          .first()

        if (activeQueue) {
          continue
        }

        const current = await db.accounts.get(remoteAccount.id)

        if (
          !current ||
          current.user_id !== userId ||
          (current.sync_status !== 'pending' &&
            current.sync_status !== 'failed')
        ) {
          continue
        }

        await db.accounts.put({
          ...remoteAccount,
          _sync_base: remoteSyncBase(remoteAccount),
          balance:
            Math.round(Number(remoteAccount.balance ?? 0) * 100) / 100,
          sync_status: 'synced',
          sync_attempts: 0,
          last_sync_error: null,
        })
      }
    }
  )

  let healed = 0

  for (const remoteAccount of remoteAccounts) {
    const current = await db.accounts.get(remoteAccount.id)
    const expectedBalance =
      Math.round(Number(remoteAccount.balance ?? 0) * 100) / 100
    const currentBalance =
      Math.round(Number(current?.balance ?? 0) * 100) / 100

    if (
      current?.sync_status === 'synced' &&
      currentBalance === expectedBalance
    ) {
      healed += 1
    }
  }

  if (healed > 0) {
    renderLog(
      `${healed} conta(s) com estado de sincronização órfão foram restauradas pelo snapshot remoto.`,
      'success'
    )
  }

  return healed
}

async function pullRemoteChanges(
  userId: string,
  force = false
): Promise<PullResult> {
  if (!snapshot.isOnline) {
    return {
      success: false,
      failedTables: [],
    }
  }

  renderLog(
    `Iniciando recebimento remoto${force ? ' em modo completo' : ''}.`,
    'info'
  )

  try {
    const lastPullKey = `dfl_last_pull_${userId}`
    const storedLastPull =
      localStorage.getItem(lastPullKey) || '2000-01-01T00:00:00.000Z'
    const fullKey = `dfl_last_full_pull_${userId}`
    const fullDue = Date.now() - Number(localStorage.getItem(fullKey) || 0) >= 30 * 60_000
    const fullSnapshot = force || fullDue
    let remoteHighWater = fullSnapshot ? '2000-01-01T00:00:00.000Z' : storedLastPull
    const failedTables: SyncTableName[] = []
    let skippedProtectedRemoteRows = false

    for (const tableName of SYNC_TABLES) {
      let effectiveLastPull = storedLastPull

      try {
        const localCount = await db
          .table(tableName)
          .where('user_id')
          .equals(userId)
          .count()

        if (fullSnapshot || localCount === 0) {
          effectiveLastPull = '2000-01-01T00:00:00.000Z'
        }
      } catch {
        effectiveLastPull = '2000-01-01T00:00:00.000Z'
      }

      let remoteData: any[]
      try {
        const overlap = effectiveLastPull === '2000-01-01T00:00:00.000Z' ? undefined :
          new Date(Math.max(0, Date.parse(effectiveLastPull) - 5 * 60_000)).toISOString()
        remoteData = await fetchRemoteSyncRows(tableName, userId, overlap)
        if (currentUserId !== userId) return { success: false, failedTables: [] }
        for (const row of remoteData) {
          if (typeof row.updated_at === 'string' && Date.parse(row.updated_at) >= Date.parse(remoteHighWater)) remoteHighWater = row.updated_at
        }
      } catch (error: any) {
        failedTables.push(tableName)
        renderLog(`Falha ao receber ${tableName}: ${error.message}`, 'error')
        continue
      }

      // Recheck the queue inside the same write transaction as apply/prune.
      await db.transaction('rw', db.table(tableName), db.syncQueue, async () => {
        const latestQueue = await db.syncQueue.where('user_id').equals(userId)
          .filter(item => item.table === tableName).toArray()
        const protectedNow = new Set(latestQueue.map(item => item.record_id))
        const safeRows = remoteData.filter(item => !protectedNow.has(item.id))
        if (safeRows.length < remoteData.length) skippedProtectedRemoteRows = true
        if (safeRows.length) await db.table(tableName).bulkPut(safeRows.map(item => ({
          ...item, _sync_base: remoteSyncBase(item),
          sync_status: 'synced', sync_attempts: 0, last_sync_error: null,
        })))
        if (fullSnapshot) {
          const remoteIds = new Set(remoteData.map(item => item.id))
          const currentLocal = await db.table(tableName).where('user_id').equals(userId).toArray()
          const stale = currentLocal.filter(item => item.sync_status === 'synced' &&
            !remoteIds.has(item.id) && !protectedNow.has(item.id)).map(item => item.id)
          if (stale.length) await db.table(tableName).bulkDelete(stale)
        }
      })

    }

    if (failedTables.length === 0) {
      /*
       * Nunca avance o cursor além de uma linha remota que foi ignorada
       * por existir mutação local na fila. Caso contrário, depois que a
       * fila for resolvida, um pull incremental jamais verá essa versão
       * remota novamente.
       */
      if (!skippedProtectedRemoteRows) {
        localStorage.setItem(lastPullKey, remoteHighWater)
        if (fullSnapshot) localStorage.setItem(fullKey, String(Date.now()))
      } else {
        renderLog(
          'Recebimento remoto preservou o cursor porque há registros protegidos pela fila local.',
          'info'
        )
      }

      renderLog('Recebimento remoto concluído.', 'success')

      return {
        success: true,
        failedTables: [],
      }
    }

    renderLog(
      `Recebimento parcial: ${failedTables.length} tabela(s) falharam; cutoff preservado.`,
      'error'
    )

    return {
      success: false,
      failedTables,
    }
  } catch (error: any) {
    renderLog(
      `Falha crítica no recebimento remoto: ${error?.message || 'erro desconhecido'}`,
      'error'
    )
    console.error('[SYNC] Falha crítica no recebimento remoto:', error)

    return {
      success: false,
      failedTables: [],
    }
  }
}

async function runSyncCycle(
  userId: string,
  forcePull: boolean,
  forcePushRetry = false
): Promise<SyncCycleResult> {
  if (!snapshot.isOnline) {
    const pendingCount = await refreshPendingCount(userId)

    return {
      success: false,
      pushFailures: 0,
      pendingCount,
      pullSuccess: false,
      pullFailedTables: [],
    }
  }

  setSnapshot({
    isSyncing: true,
    syncStatus: 'syncing',
  })

  let pushFailures = 0

  try {
    pushFailures = await pushAtomicFinancialBatch(userId, forcePushRetry, isRetryDue)

    const pullResult = await pullRemoteChanges(userId, forcePull)

    /*
     * V67 — segunda barreira determinística.
     * Executada após o pull para reparar estados históricos em que
     * sync_status ficou pending/failed sem qualquer operação na fila.
     */
    if (pullResult.success) {
      try {
        await healOrphanAccountSyncStates(userId)
      } catch (error: any) {
        renderLog(
          `Autocura de contas não concluída: ${error?.message || 'erro desconhecido'}`,
          'error'
        )
      }
    }

    const remainingPendingCount = await refreshPendingCount(userId)

    const success =
      pushFailures === 0 &&
      remainingPendingCount === 0 &&
      !(await db.financialOutbox.get(userId)) &&
      pullResult.success

    if (currentUserId === userId) {
      const pending = await getPendingSyncItems(userId)
      const firstError = pending.find(item => item.last_error)?.last_error
      setSnapshot({
        ...(success ? { lastSuccessfulSyncAt: new Date().toISOString() } : {}),
        lastSyncError: success ? null : firstError || (pullResult.success ? 'Confirmação remota pendente.' : 'Recebimento remoto incompleto.'),
      })
    }
    return {
      success,
      pushFailures,
      pendingCount: remainingPendingCount,
      pullSuccess: pullResult.success,
      pullFailedTables: pullResult.failedTables,
    }
  } catch (error: any) {
    console.error('[SYNC] Falha crítica no ciclo:', error)
    if (currentUserId === userId) setSnapshot({ lastSyncError: error?.message || 'Ciclo incompleto.' })

    return {
      success: false,
      pushFailures: pushFailures + 1,
      pendingCount: await refreshPendingCount(userId),
      pullSuccess: false,
      pullFailedTables: [],
    }
  } finally {
    const online =
      typeof navigator !== 'undefined' ? navigator.onLine : snapshot.isOnline

    setSnapshot({
      isSyncing: false,
      isOnline: online,
      syncStatus: online ? 'online' : 'offline',
    })
  }
}

function startSyncCycle(
  forcePull: boolean,
  forcePushRetry = false
) {
  if (!currentUserId) {
    return Promise.resolve<SyncCycleResult>({
      success: false,
      pushFailures: 0,
      pendingCount: 0,
      pullSuccess: false,
      pullFailedTables: [],
    })
  }

  const userId = currentUserId
  const running = runSyncCycle(
    userId,
    forcePull,
    forcePushRetry
  )
  const wrapped = running.finally(() => {
    if (activeSyncPromise === wrapped) {
      activeSyncPromise = null
    }
  })

  activeSyncPromise = wrapped
  return wrapped
}

export function processSyncQueue(
  forcePull = false,
  forcePushRetry = false
): Promise<SyncCycleResult> {
  ensureRuntime()

  if (activeSyncPromise) {
    if (
      !forcePull &&
      !forcePushRetry
    ) {
      return activeSyncPromise
    }

    if (!queuedForcePromise) {
      const running =
        activeSyncPromise

      queuedForcePromise =
        running
          .then(
            () =>
              startSyncCycle(
                forcePull,
                forcePushRetry
              ),
            () =>
              startSyncCycle(
                forcePull,
                forcePushRetry
              )
          )
          .finally(() => {
            queuedForcePromise = null
          })
    }

    return queuedForcePromise
  }

  return startSyncCycle(
    forcePull,
    forcePushRetry
  )
}
