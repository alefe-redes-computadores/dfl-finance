// V180 — Apresentação de sincronização; nenhuma operação financeira.
// A fonte é o snapshot existente do syncEngine.

import { syncSafetyStatus } from './syncSafetyPresentation'

export type BadgeKind =
  | 'offline'
  | 'syncing'
  | 'error'
  | 'pending'
  | 'verified'
  | 'unverified'

export type BadgeInput = {
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  hasFinancialOutbox?: boolean
  lastSuccessfulSyncAt?: string | null
  lastSyncError?: string | null
}

export type BadgeView = {
  kind: BadgeKind
  label: string
  detail: string
  pending: number
}

export function getSyncBadgePresentation(
  input: BadgeInput
): BadgeView {
  const pending = Number.isFinite(input.pendingCount)
    ? Math.max(0, Math.trunc(input.pendingCount))
    : 0

  const safety = syncSafetyStatus({
    online: input.isOnline,
    pending,
    hasOutbox: Boolean(input.hasFinancialOutbox),
    lastSuccess: input.lastSuccessfulSyncAt || null,
    lastError: input.lastSyncError || null
  })

  if (!input.isOnline) {
    return {
      kind: 'offline',
      label: 'Sem conexão',
      detail: safety.message,
      pending
    }
  }

  if (input.isSyncing) {
    return {
      kind: 'syncing',
      label: 'Sincronizando',
      detail: 'Enviando e conferindo dados. Aguarde a confirmação do ciclo.',
      pending
    }
  }

  if (
    safety.kind === 'legacy' ||
    safety.kind === 'conflict' ||
    safety.kind === 'backend' ||
    safety.kind === 'ledger' ||
    safety.kind === 'retry'
  ) {
    return {
      kind: 'error',
      label: 'Sincronização incompleta',
      detail: safety.message,
      pending
    }
  }

  if (safety.kind === 'pending') {
    return {
      kind: 'pending',
      label: 'Alterações aguardando confirmação',
      detail: safety.message,
      pending
    }
  }

  if (safety.kind === 'verified') {
    return {
      kind: 'verified',
      label: 'Sincronização confirmada',
      detail: safety.message,
      pending
    }
  }

  return {
    kind: 'unverified',
    label: 'Confirmação não verificada',
    detail: safety.message,
    pending
  }
}
