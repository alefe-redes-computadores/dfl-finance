export type SyncSafetyKind = 'legacy' | 'conflict' | 'backend' | 'ledger' | 'retry' | 'pending' | 'verified' | 'unverified' | 'offline'
export function syncFailurePresentation(message?: string | null): { kind: SyncSafetyKind; message: string } | null {
  if (!message) return null
  if (/DFL_LEGACY_REVIEW/.test(message)) return { kind: 'legacy', message: 'Há uma alteração antiga sem base verificável. Ela foi preservada para revisão.' }
  if (/DFL_SYNC_CONFLICT/.test(message)) return { kind: 'conflict', message: 'Outro dispositivo mudou este registro. Sua alteração local foi preservada.' }
  if (/DFL_CASH_TRAIL_MISMATCH|DFL_ACCOUNT_EFFECT_MISSING|DFL_TRANSFER_GROUP_INCOMPLETE|DFL_REFERENCE_NOT_OWNED/.test(message)) return { kind: 'ledger', message: 'Uma operação precisa de revisão financeira. O lote não foi aplicado parcialmente.' }
  if (/PGRST202|could not find.*function|function.*does not exist|schema cache|servidor não confirmou/i.test(message)) return { kind: 'backend', message: 'O servidor ainda não confirmou o contrato financeiro desta versão. Os dados locais foram preservados.' }
  return { kind: 'retry', message: 'Não foi possível confirmar a sincronização. A operação foi preservada para nova tentativa.' }
}
export function syncSafetyStatus(input: { online: boolean; pending: number; hasOutbox: boolean; lastSuccess: string | null; lastError: string | null }) {
  if (!input.online) return { kind: 'offline' as const, message: 'Salvo neste dispositivo. A confirmação remota depende de conexão.' }
  const error = syncFailurePresentation(input.lastError)
  if (error) return error
  if (input.pending || input.hasOutbox) return { kind: 'pending' as const, message: 'Há alterações locais aguardando confirmação remota.' }
  if (!input.lastSuccess) return { kind: 'unverified' as const, message: 'A fila está vazia. A sincronização ainda não foi verificada nesta sessão.' }
  return { kind: 'verified' as const, message: 'A última sincronização completa foi confirmada e não há alterações na fila.' }
}


/** R119: diagnostico local somente-leitura. Nunca autoriza retry ou altera fila. */
export type LocalSyncDiagnostic = {
  kind: SyncSafetyKind
  headline: string
  action: 'none' | 'wait' | 'connect' | 'review' | 'retry'
  canRetry: boolean
  pendingCount: number
  hasOutbox: boolean
}

export function localSyncDiagnostic(input: {
  online: boolean
  syncing: boolean
  pending: number
  hasOutbox: boolean
  lastSuccess: string | null
  lastError: string | null
}): LocalSyncDiagnostic {
  const pendingCount = Number.isFinite(input.pending)
    ? Math.max(0, Math.floor(input.pending)) : 0
  const status = syncSafetyStatus({
    online: input.online,
    pending: pendingCount,
    hasOutbox: input.hasOutbox,
    lastSuccess: input.lastSuccess,
    lastError: input.lastError,
  })
  if (!input.online) return {
    kind: 'offline', headline: status.message, action: 'connect',
    canRetry: false, pendingCount, hasOutbox: input.hasOutbox,
  }
  if (input.syncing) return {
    kind: status.kind, headline: 'Sincronizacao em andamento. Aguarde a confirmacao.',
    action: 'wait', canRetry: false, pendingCount, hasOutbox: input.hasOutbox,
  }
  const needsReview = ['legacy', 'conflict', 'ledger', 'backend'].includes(status.kind)
  if (needsReview) return {
    kind: status.kind, headline: status.message, action: 'review',
    canRetry: false, pendingCount, hasOutbox: input.hasOutbox,
  }
  const retry = status.kind === 'retry' || status.kind === 'pending'
  return {
    kind: status.kind, headline: status.message,
    action: retry ? 'retry' : 'none',
    canRetry: retry,
    pendingCount, hasOutbox: input.hasOutbox,
  }
}
