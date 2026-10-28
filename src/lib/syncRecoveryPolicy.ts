/**
 * R397 — regras puras de sincronização.
 * Sem IndexedDB, Supabase ou operações financeiras.
 */

export type PendingSyncRequest = {
  forcePull: boolean
  forcePushRetry: boolean
}

export function mergeSyncRequests(
  current: PendingSyncRequest,
  incoming: PendingSyncRequest
): PendingSyncRequest {
  return {
    forcePull: current.forcePull || incoming.forcePull,
    forcePushRetry:
      current.forcePushRetry || incoming.forcePushRetry,
  }
}

export function syncRetryDelayMs(
  attempts: number
): number {
  if (attempts <= 0) return 0
  if (attempts === 1) return 30_000
  if (attempts === 2) return 60_000
  if (attempts === 3) return 2 * 60_000
  if (attempts === 4) return 5 * 60_000
  if (attempts === 5) return 15 * 60_000
  return 30 * 60_000
}

export function isSyncRetryDue(
  item: {
    attempts?: number | null
    last_attempt_at?: string | null
  },
  nowMs: number
): boolean {
  const attempts = item.attempts || 0

  if (attempts === 0 || !item.last_attempt_at) {
    return true
  }

  const lastAttemptAt = Date.parse(item.last_attempt_at)

  if (!Number.isFinite(lastAttemptAt)) {
    return true
  }

  return nowMs - lastAttemptAt >=
    syncRetryDelayMs(attempts)
}
