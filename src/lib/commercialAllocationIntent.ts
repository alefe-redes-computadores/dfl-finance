/** R462 — intenção comercial durável no dispositivo, sem gravar saldo financeiro. */
export interface CommercialAllocationIntent {
  key: string
  ownerId: string
  storeId: string
  platformId: string
  saleId: string
  receiptId: string
  amountCents: number
  createdAt: string
}

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i
const KEY_PREFIX = 'dfl_finance_commercial_allocation_v1:'

function storageKey(ownerId: string): string {
  if (!UUID.test(ownerId)) throw new Error('Usuário inválido para a operação comercial.')
  return `${KEY_PREFIX}${ownerId}`
}

function validIntent(input: unknown, ownerId: string): input is CommercialAllocationIntent {
  if (!input || typeof input !== 'object') return false
  const row = input as Record<string, unknown>
  return row.ownerId === ownerId &&
    ['key', 'ownerId', 'storeId', 'platformId', 'saleId', 'receiptId'].every(field =>
      typeof row[field] === 'string' && UUID.test(row[field] as string)) &&
    typeof row.amountCents === 'number' && Number.isSafeInteger(row.amountCents) && row.amountCents > 0 &&
    typeof row.createdAt === 'string' && Number.isFinite(Date.parse(row.createdAt))
}

export function makeCommercialAllocationIntent(input: Omit<CommercialAllocationIntent, 'key' | 'createdAt'>): CommercialAllocationIntent {
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('Geração segura de identidade indisponível neste dispositivo.')
  }
  const candidate: CommercialAllocationIntent = {
    ...input, key: crypto.randomUUID(), createdAt: new Date().toISOString(),
  }
  if (!validIntent(candidate, input.ownerId)) throw new Error('Dados inválidos para a conciliação comercial.')
  return candidate
}

export function loadCommercialAllocationIntent(ownerId: string): CommercialAllocationIntent | null {
  const raw = localStorage.getItem(storageKey(ownerId))
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!validIntent(value, ownerId)) {
      throw new Error('Há uma tentativa comercial salva com dados inválidos. Não foi sobrescrita.')
    }
    return value
  } catch (error) {
    throw error instanceof SyntaxError
      ? new Error('A tentativa comercial salva está corrompida. Não foi sobrescrita.')
      : error
  }
}

/** Persiste antes da primeira chamada RPC. Nunca troca a intenção silenciosamente. */
export function saveCommercialAllocationIntent(intent: CommercialAllocationIntent): void {
  if (!validIntent(intent, intent.ownerId)) throw new Error('Tentativa comercial inválida.')
  const existing = loadCommercialAllocationIntent(intent.ownerId)
  if (existing && (existing.key !== intent.key || existing.saleId !== intent.saleId ||
    existing.receiptId !== intent.receiptId || existing.amountCents !== intent.amountCents ||
    existing.storeId !== intent.storeId || existing.platformId !== intent.platformId)) {
    throw new Error('Há uma alocação anterior aguardando confirmação. Retome-a primeiro.')
  }
  localStorage.setItem(storageKey(intent.ownerId), JSON.stringify(intent))
  const saved = loadCommercialAllocationIntent(intent.ownerId)
  if (!saved || saved.key !== intent.key) {
    throw new Error('Não foi possível confirmar a gravação local da tentativa.')
  }
}

export function clearCommercialAllocationIntent(intent: CommercialAllocationIntent): void {
  const saved = loadCommercialAllocationIntent(intent.ownerId)
  if (!saved) return
  if (saved.key !== intent.key) {
    throw new Error('A tentativa mudou; a nova não será descartada.')
  }
  localStorage.removeItem(storageKey(intent.ownerId))
}
