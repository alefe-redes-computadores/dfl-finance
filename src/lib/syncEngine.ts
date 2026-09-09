// src/lib/syncEngine.ts
'use client'

import { liveQuery } from 'dexie'
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
  isSyncing: boolean
}

const SERVER_SNAPSHOT: SyncSnapshot = {
  syncStatus: 'idle',
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
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
    next.isSyncing === snapshot.isSyncing
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

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  periodicSyncTimer = setInterval(() => {
    if (!currentUserId || !snapshot.isOnline) return
    void processSyncQueue(false)
  }, 60_000)
}

function watchPendingCount(userId: string | null) {
  pendingSubscription?.unsubscribe()
  pendingSubscription = null

  if (!userId) {
    setSnapshot({ pendingCount: 0 })
    return
  }

  pendingSubscription = liveQuery(() =>
    db.syncQueue.where('user_id').equals(userId).count()
  ).subscribe({
    next: (count) => {
      if (currentUserId === userId) {
        setSnapshot({ pendingCount: count })
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
  watchPendingCount(userId)

  if (userId && online) {
    void processSyncQueue(false)
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
      setSnapshot({ pendingCount: 0 })
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

const LOCAL_ONLY_REMOTE_KEYS =
  new Set([
    'syncstatus',
    'syncattempts',
    'lastsyncerror',
  ])

const TRANSACTION_PRESENTATION_REMOTE_KEYS =
  new Set([
    'categoryname',
    'accountname',
  ])

function sanitizeRemotePayload(
  source: Record<string, any>,
  recordId: string,
  userId: string,
  table?: LocalSyncQueue['table']
) {
  const sanitizedEntries =
    Object.entries(source)
      .filter(([key, value]) => {
        if (value === undefined) {
          return false
        }

        const normalizedKey =
          key
            .replace(
              /[^a-zA-Z0-9]/g,
              ''
            )
            .toLowerCase()

        return (
          !LOCAL_ONLY_REMOTE_KEYS.has(
            normalizedKey
          ) &&
          !(
            table ===
              'transactions' &&
            TRANSACTION_PRESENTATION_REMOTE_KEYS.has(
              normalizedKey
            )
          )
        )
      })
      .map(([key, value]) => {
        const normalizedKey =
          key
            .replace(
              /[^a-zA-Z0-9]/g,
              ''
            )
            .toLowerCase()

        const legacyRemoteKeyAliases: Record<string, string> = {
          accountid: 'account_id',
          categoryid: 'category_id',
          creditcardid: 'credit_card_id',
          invoiceid: 'invoice_id',
          debtid: 'debt_id',
          goalid: 'goal_id',
          contactid: 'contact_id',
          linkedtransactionid: 'linked_transaction_id',
          recurringgroupid: 'recurring_group_id',
          affectsbalance: 'affects_balance',
          createdat: 'created_at',
          updatedat: 'updated_at',
        }

        const canonicalKey =
          legacyRemoteKeyAliases[normalizedKey]

        if (canonicalKey) {
          return [
            canonicalKey,
            value,
          ]
        }

        if (
          table ===
            'chat_history' &&
          key === 'role' &&
          value === 'assistant'
        ) {
          return [
            'role',
            'model',
          ]
        }

        return [
          key,
          value,
        ]
      })

  return Object.fromEntries([
    ...sanitizedEntries,
    ['id', recordId],
    ['user_id', userId],
  ])
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
    const syncTime = new Date().toISOString()
    const failedTables: SyncTableName[] = []

    for (const tableName of SYNC_TABLES) {
      let effectiveLastPull = storedLastPull

      try {
        const localCount = await db
          .table(tableName)
          .where('user_id')
          .equals(userId)
          .count()

        if (force || localCount === 0) {
          effectiveLastPull = '2000-01-01T00:00:00.000Z'
        }
      } catch {
        effectiveLastPull = '2000-01-01T00:00:00.000Z'
      }

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', effectiveLastPull)

      if (error) {
        failedTables.push(tableName)
        renderLog(
          `Falha ao receber ${tableName}: ${error.message}`,
          'error'
        )
        continue
      }

      const remoteData = data ?? []
      const currentPendingItems = await getPendingSyncItems(userId)

      const pendingIds = new Set(
        currentPendingItems
          .filter((pendingItem) => pendingItem.table === tableName)
          .map((pendingItem) => pendingItem.record_id)
      )

      const localRows = await db
        .table(tableName)
        .where('user_id')
        .equals(userId)
        .toArray()

      const localRowsById = new Map(
        localRows
          .filter((item: any) => typeof item?.id === 'string')
          .map((item: any) => [item.id, item])
      )

      const isLocallyProtected = (id: string) => {
        if (pendingIds.has(id)) return true

        const localItem: any = localRowsById.get(id)

        return Boolean(
          localItem &&
            localItem.sync_status &&
            localItem.sync_status !== 'synced'
        )
      }

      const remoteDataSafeToApply = remoteData.filter(
        (item: any) =>
          typeof item?.id !== 'string' || !isLocallyProtected(item.id)
      )

      if (remoteDataSafeToApply.length > 0) {
        const localData =
          remoteDataSafeToApply.map(
            (item: any) => ({
              ...item,
              sync_status:
                'synced',
              sync_attempts:
                0,
              last_sync_error:
                null,
            })
          )

        await db
          .table(tableName)
          .bulkPut(localData)
      }

      if (force) {
        const remoteIds = new Set(
          remoteData
            .map((item: any) => item?.id)
            .filter(
              (id: any): id is string =>
                typeof id === 'string' && id.length > 0
            )
        )

        const staleSyncedIds = localRows
          .filter((item: any) => {
            if (typeof item?.id !== 'string') return false
            if (remoteIds.has(item.id)) return false
            if (isLocallyProtected(item.id)) return false
            return item.sync_status === 'synced'
          })
          .map((item: any) => item.id)

        if (staleSyncedIds.length > 0) {
          await db.table(tableName).bulkDelete(staleSyncedIds)
        }
      }
    }

    if (failedTables.length === 0) {
      localStorage.setItem(lastPullKey, syncTime)
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
    const items =
      await getPendingSyncItems(userId)

    const syncPriority:
      Partial<Record<
        LocalSyncQueue['table'],
        number
      >> = {
        categories: 10,
        accounts: 20,
        contacts: 30,
        credit_cards: 40,
        debts: 50,
        loans: 60,
        financings: 70,
        subscriptions: 80,
        tags: 90,
        budgets: 100,
        goals: 110,
        chat_sessions: 120,
        transactions: 200,
        credit_invoices: 210,
        notifications: 220,
        chat_history: 230,
      }

    items.sort((a, b) => {
      const priorityA =
        syncPriority[a.table] ??
        150

      const priorityB =
        syncPriority[b.table] ??
        150

      if (
        priorityA !== priorityB
      ) {
        return (
          priorityA -
          priorityB
        )
      }

      return String(
        a.created_at || ''
      ).localeCompare(
        String(
          b.created_at || ''
        )
      )
    })

    for (const item of items) {
      if (
        !forcePushRetry &&
        !isRetryDue(item)
      ) {
        continue
      }

      const itemRevision = item.revision ?? 0

      try {
        const currentQueueItem = await db.syncQueue.get(item.id)

        if (
          !currentQueueItem ||
          (currentQueueItem.revision ?? 0) !== itemRevision
        ) {
          continue
        }

        const supabaseClient = supabase.from(item.table)

        if (item.operation === 'delete') {
          const { error } = await supabaseClient
            .delete()
            .eq('id', item.record_id)
            .eq('user_id', userId)

          if (error) {
            throw new Error(error.message)
          }
        } else {
          const localRecord = await db.table(item.table).get(item.record_id)

          if (!localRecord) {
            throw new Error(
              `Registro local ${item.table}/${item.record_id} não encontrado para envio.`
            )
          }

          if (localRecord.user_id !== userId) {
            throw new Error(
              `Registro local ${item.table}/${item.record_id} pertence a outro usuário.`
            )
          }

          const payload = sanitizeRemotePayload(
            localRecord,
            item.record_id,
            userId,
            item.table
          )

          const { error } = await supabaseClient.upsert(payload, {
            onConflict: 'id',
          })

          if (error) {
            throw new Error(error.message)
          }
        }

        const confirmed = await confirmSyncSuccessIfCurrent(
          item.id,
          itemRevision
        )

        if (confirmed) {
          renderLog(
            `${item.table}/${item.record_id} confirmado e removido da fila.`,
            'success'
          )
        } else {
          renderLog(
            `${item.table}/${item.record_id} mudou durante o envio; revisão nova preservada.`,
            'info'
          )
        }
      } catch (error: any) {
        const message = error?.message || 'Falha desconhecida no envio.'
        const failureRecorded = await markSyncFailedIfCurrent(
          item.id,
          itemRevision,
          message
        )

        if (failureRecorded) {
          pushFailures += 1
          renderLog(
            `${item.table}/${item.record_id} permaneceu na fila após falha: ${message}`,
            'error'
          )
        }
      }
    }

    const pullResult = await pullRemoteChanges(userId, forcePull)
    const remainingPendingCount = await refreshPendingCount(userId)

    const success =
      pushFailures === 0 &&
      remainingPendingCount === 0 &&
      pullResult.success

    return {
      success,
      pushFailures,
      pendingCount: remainingPendingCount,
      pullSuccess: pullResult.success,
      pullFailedTables: pullResult.failedTables,
    }
  } catch (error: any) {
    console.error('[SYNC] Falha crítica no ciclo:', error)

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
