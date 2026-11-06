/** R453 — Indicadores de visita para a Home. Nunca calcula ou grava saldo. */
export type HomeDecisionTransaction = {
  id?: unknown
  type?: unknown
  amount?: unknown
  status?: unknown
  account_id?: unknown
  date?: unknown
  due_date?: unknown
  created_at?: unknown
  updated_at?: unknown
}

export type HomeVisitSignature = {
  version: 1
  count: number
  fingerprint: string
}

const text = (value: unknown): string => value == null ? '' : String(value)

/** Hash de comparação NÃO criptográfico. Nenhuma linha financeira é persistida. */
function fingerprint(payload: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < payload.length; index++) {
    hash ^= payload.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function createHomeVisitSignature(rows: HomeDecisionTransaction[]): HomeVisitSignature {
  const entries = rows.map(row => [
    text(row.id), text(row.type), text(row.amount), text(row.status),
    text(row.account_id), text(row.date), text(row.due_date),
    text(row.created_at), text(row.updated_at),
  ].join('\u001f')).sort()
  return { version: 1, count: entries.length, fingerprint: fingerprint(entries.join('\u001e')) }
}

export function readHomeVisitSignature(raw: string | null): HomeVisitSignature | null {
  if (!raw || raw.length > 200) return null
  try {
    const input: unknown = JSON.parse(raw)
    if (!input || typeof input !== 'object') return null
    const item = input as Partial<HomeVisitSignature>
    if (item.version !== 1 || typeof item.count !== 'number' || !Number.isSafeInteger(item.count) || item.count < 0 ||
        typeof item.fingerprint !== 'string' || !/^[a-f0-9]{8}$/.test(item.fingerprint)) return null
    return { version: 1, count: item.count, fingerprint: item.fingerprint }
  } catch {
    return null
  }
}

export function describeHomeChanges(previous: HomeVisitSignature | null, current: HomeVisitSignature): string {
  if (!previous) return 'Primeira visita nesta instalação; sem comparação anterior.'
  if (previous.count === current.count && previous.fingerprint === current.fingerprint) {
    return 'Nenhuma alteração identificada nos lançamentos locais.'
  }
  const difference = current.count - previous.count
  if (difference > 0) return `${difference} lançamento${difference === 1 ? '' : 's'} a mais nesta visão.`
  if (difference < 0) return `${Math.abs(difference)} lançamento${difference === -1 ? '' : 's'} a menos nesta visão.`
  return 'Há lançamentos alterados desde sua última visita.'
}

export type HomeTrustInput = {
  isOnline: boolean
  isSyncing: boolean
  hasSyncFailure: boolean
  pendingCount: number
  hasFinancialOutbox: boolean
  isBalanceReconciling: boolean
  balanceVerifiedAt: string | null
  lastSuccessfulSyncAt: string | null
}
export type HomeTrustSignal = { label: string; description: string; tone: 'safe' | 'caution' | 'neutral' }

/** Nunca declarar confirmação com fila, erro, offline ou saldo em reconciliação. */
export function homeTrustSignal(input: HomeTrustInput): HomeTrustSignal {
  const waiting = Number.isFinite(input.pendingCount) ? Math.max(0, Math.trunc(input.pendingCount)) : 0
  if (!input.isOnline) return {
    label: 'Você está offline', description: waiting > 0 || input.hasFinancialOutbox
      ? 'Dados locais; há alterações aguardando envio.' : 'Dados salvos no dispositivo; servidor não verificado.', tone: 'caution',
  }
  if (input.hasSyncFailure) return {
    label: 'Sincronização exige atenção', description: 'Há uma falha registrada. Confira o status de sincronização.', tone: 'caution',
  }
  if (waiting > 0 || input.hasFinancialOutbox) return {
    label: 'Alterações não confirmadas', description: `${waiting} item(ns) na fila local${input.hasFinancialOutbox ? ' e operação financeira em espera' : ''}.`, tone: 'caution',
  }
  if (input.isSyncing || input.isBalanceReconciling) return {
    label: 'Conferindo dados', description: 'Sincronização ou saldo ainda em verificação.', tone: 'neutral',
  }
  if (!input.lastSuccessfulSyncAt || !input.balanceVerifiedAt) return {
    label: 'Aguardando confirmação', description: 'Ainda não há confirmação completa de sincronização e saldo nesta sessão.', tone: 'neutral',
  }
  return {
    label: 'Última sincronização concluída', description: 'Sem pendências locais reportadas; consulte o status para detalhes.', tone: 'safe',
  }
}
