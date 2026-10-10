import { db, addToSyncQueue, type LocalTransaction } from '@/lib/db'
import { transactionRevisionSignature } from '@/lib/financialRevision'
import { civilDate } from '@/lib/financialForecast'

export type TransferPair = { outgoing: LocalTransaction; incoming: LocalTransaction }
/** Direction is ledger metadata. Never infer financial direction from a description. */
export function resolveTransferPair(rows: LocalTransaction[]): TransferPair {
  const outgoing = rows.find(row => row.transfer_direction === 'out')
  const incoming = rows.find(row => row.transfer_direction === 'in')
  if (rows.length !== 2 || !outgoing || !incoming ||
    !outgoing.transfer_group_id || outgoing.transfer_group_id !== incoming.transfer_group_id ||
    rows.some(row => row.user_id !== outgoing.user_id || row.type !== 'transfer' || row.status !== 'done' ||
      !Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0) ||
    Math.round(outgoing.amount * 100) !== Math.round(incoming.amount * 100) ||
    !outgoing.account_id || !incoming.account_id || outgoing.account_id === incoming.account_id ||
    outgoing.to_account_id !== incoming.account_id || incoming.to_account_id !== outgoing.account_id) {
    throw new Error('Transferência sem duas pernas verificáveis. Preserve o movimento para revisão; nenhuma direção será adivinhada.')
  }
  return { outgoing, incoming }
}

export type TransferRevision = { id: string; updated_at: string; signature: string }
export const transferRevision = (row: LocalTransaction): TransferRevision => ({ id: row.id, updated_at: row.updated_at, signature: transactionRevisionSignature(row) })
export type TransferCorrection = {
  userId: string; groupId: string; expected: TransferRevision[]
  fromAccountId: string; toAccountId: string; amount: number; date: string; description: string
}

function verifyRevision(pair: TransferPair, expected: TransferRevision[]) {
  if (expected.length !== 2 || [pair.outgoing, pair.incoming].some(row =>
    !expected.some(version => version.id === row.id && version.updated_at === row.updated_at && version.signature === transactionRevisionSignature(row)))) {
    throw new Error('Esta transferência mudou desde que foi aberta. Reabra antes de confirmar.')
  }
}

async function groupRows(userId: string, groupId: string) {
  return db.transactions.where('user_id').equals(userId)
    .filter(row => row.transfer_group_id === groupId).toArray()
}

/** Both accounts, both legs and every queue item commit or roll back together. */
export async function correctTransferMovement(input: TransferCorrection) {
  if (!input.userId || !input.groupId) throw new Error('Transferência inválida.')
  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0 || !civilDate(input.date) ||
      !input.fromAccountId || !input.toAccountId || input.fromAccountId === input.toAccountId) {
    throw new Error('Informe contas diferentes, data e valor válidos.')
  }
  return db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
    const pair = resolveTransferPair(await groupRows(input.userId, input.groupId))
    const { outgoing, incoming } = pair
    // An unchanged retry never reapplies cash, even after losing the local response.
    const description = input.description.trim()
    if (outgoing.account_id === input.fromAccountId && incoming.account_id === input.toAccountId &&
        outgoing.amount === amount && incoming.amount === amount && outgoing.date === input.date &&
        incoming.date === input.date && outgoing.description === description && incoming.description === description) {
      return { alreadyApplied: true }
    }
    verifyRevision(pair, input.expected)
    const ids = new Set([outgoing.account_id!, incoming.account_id!, input.fromAccountId, input.toAccountId])
    const accounts = new Map()
    for (const id of Array.from(ids)) {
      const account = await db.accounts.get(id)
      if (!account || account.user_id !== input.userId || !Number.isFinite(Number(account.balance))) {
        throw new Error('Uma conta da transferência não está disponível para este usuário.')
      }
      if ((id === input.fromAccountId || id === input.toAccountId) && account.is_archived) {
        throw new Error('Escolha contas ativas para a transferência.')
      }
      accounts.set(id, account)
    }
    const now = new Date().toISOString()
    const deltas = new Map<string, number>()
    const add = (id: string, cents: number) => deltas.set(id, (deltas.get(id) || 0) + cents)
    add(outgoing.account_id!, Math.round(outgoing.amount * 100))
    add(incoming.account_id!, -Math.round(incoming.amount * 100))
    add(input.fromAccountId, -Math.round(amount * 100))
    add(input.toAccountId, Math.round(amount * 100))
    for (const [id, delta] of Array.from(deltas)) {
      if (!delta) continue
      const account = accounts.get(id)
      const updated = { ...account, balance: (Math.round(Number(account.balance) * 100) + delta) / 100,
        updated_at: now, sync_status: 'pending' as const }
      await db.accounts.put(updated)
      await addToSyncQueue(input.userId, 'accounts', 'update', id, updated)
    }
    for (const [old, accountId, counterpartId, direction] of [
      [outgoing, input.fromAccountId, input.toAccountId, 'out'],
      [incoming, input.toAccountId, input.fromAccountId, 'in'],
    ] as const) {
      const updated = { ...old, account_id: accountId, to_account_id: counterpartId,
        amount, date: input.date, description, context: accounts.get(accountId).context,
        transfer_direction: direction, cash_delta: direction === 'out' ? -amount : amount,
        updated_at: now, sync_status: 'pending' as const }
      await db.transactions.put(updated)
      await addToSyncQueue(input.userId, 'transactions', 'update', updated.id, updated)
    }
    return { alreadyApplied: false }
  })
}

/** Cancellation restores cash and removes the entire movement. Outbox keeps deletions until ACK. */
export async function cancelTransferMovement(userId: string, groupId: string, expected: TransferRevision[]) {
  if (!userId || !groupId) throw new Error('Transferência inválida.')
  return db.transaction('rw', db.accounts, db.transactions, db.syncQueue, async () => {
    const rows = await groupRows(userId, groupId)
    if (!rows.length) return { alreadyCancelled: true }
    const pair = resolveTransferPair(rows)
    verifyRevision(pair, expected)
    const now = new Date().toISOString()
    for (const [row, sign] of [[pair.outgoing, 1], [pair.incoming, -1]] as const) {
      const account = await db.accounts.get(row.account_id!)
      if (!account || account.user_id !== userId || !Number.isFinite(Number(account.balance))) {
        throw new Error('Conta original indisponível. Nenhuma perna será excluída isoladamente.')
      }
      const updated = { ...account,
        balance: (Math.round(Number(account.balance) * 100) + sign * Math.round(row.amount * 100)) / 100,
        updated_at: now, sync_status: 'pending' as const }
      await db.accounts.put(updated)
      await addToSyncQueue(userId, 'accounts', 'update', account.id, updated)
      await addToSyncQueue(userId, 'transactions', 'delete', row.id, row)
      await db.transactions.delete(row.id)
    }
    return { alreadyCancelled: false }
  })
}
