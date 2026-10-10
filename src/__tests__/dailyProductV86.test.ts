/** @jest-environment node */
import 'fake-indexeddb/auto'
import { webcrypto, randomUUID } from 'node:crypto'
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }))
import { db } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { transferBetweenAccounts } from '@/lib/accountOperations'
import { resolveTransferPair, transferRevision, correctTransferMovement, cancelTransferMovement } from '@/lib/transferMovementOperations'
import { pushAtomicFinancialBatch } from '@/lib/atomicFinancialSync'
import { transactionCashEffect } from '@/lib/financialSyncContract'
import { belongsInFinancialInbox, needsFinancialReview } from '@/lib/inboxPolicy'
import { conciliatePendingTransaction, saveConciliationReview } from '@/lib/conciliationOperations'
import { parseDateIntent, searchFinancialData, resolveFinancialCommands } from '@/lib/globalSearch'
import { createRecoveryBackup, restoreRecoveryBackup, validateRecoveryBackup } from '@/lib/recoveryBackup'
import { repairFutureScheduledTransactions } from '@/lib/futureTransactionOperations'
import { assertTransactionUnchanged } from '@/lib/financialRevision'
import { syncSafetyStatus, syncFailurePresentation } from '@/lib/syncSafetyPresentation'
const rpc = supabase.rpc as jest.Mock
const uid = randomUUID(), from = randomUUID(), to = randomUUID(), third = randomUUID()
const date = '2026-10-09', version = date + 'T12:00:00.000Z'
const account = (id: string, name: string, balance: number, context: 'dfl'|'personal' = 'dfl') => ({ id, user_id: uid, name, balance, context, color: '#000', is_archived: false, created_at: version, updated_at: version, sync_status: 'synced' as const })
const tx = (patch: any = {}) => ({ id: randomUUID(), user_id: uid, amount: 20, type: 'expense' as const, status: 'pending' as const, context: 'dfl' as const, account_id: from, date, description: 'Despesa', source: 'manual', affects_balance: false, created_at: version, updated_at: version, sync_status: 'synced' as const, ...patch })
const start = async () => { const groupId = randomUUID(); await transferBetweenAccounts({ userId: uid, fromAccountId: from, toAccountId: to, amount: 20, operationId: groupId, description: 'Transferir' }); return groupId }
const revision = async () => (await db.transactions.toArray()).map(transferRevision)
const correction = async (groupId: string, patch: any = {}) => ({ userId: uid, groupId, expected: await revision(), fromAccountId: from, toAccountId: to, amount: 30, date, description: 'Corrigida', ...patch })
const balance = async (id = from) => (await db.accounts.get(id))!.balance
const reply = (_name: string, args: any) => Promise.resolve({ error: null, data: { status: 'committed', batch_id: args.p_batch_id,
  versions: Object.fromEntries(args.p_items.map((item: any) => [`${item.table}/${item.record_id}`, item.operation === 'delete' ? null : '2026-10-09T19:00:00.000Z'])),
  accounts: Object.fromEntries(args.p_items.filter((item: any) => item.table === 'accounts').map((item: any) => [item.record_id, { ...item.data, updated_at: '2026-10-09T19:00:00.000Z' }])) } })
beforeAll(() => Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }))
beforeEach(async () => {
  rpc.mockReset()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.accounts.bulkAdd([account(from, 'InfinitePay', 100), account(to, 'Nubank', 50), account(third, 'Pessoal', 70, 'personal')])
})
afterAll(async () => { await db.delete() })

test('correction restores old effect and applies both legs exactly once', async () => {
  const group = await start(), input = await correction(group)
  await correctTransferMovement(input); await correctTransferMovement(input)
  expect(await balance()).toBe(70); expect(await balance(to)).toBe(80)
  const rows = await db.transactions.toArray(); expect(rows).toHaveLength(2)
  expect(rows.map(transactionCashEffect).reduce((a, b) => Number(a) + Number(b), 0)).toBe(0)
  expect(rows.every(row => row.transfer_group_id === group && row.description === 'Corrigida')).toBe(true)
})
test('changing destination and direction preserves both contexts and fresh balances', async () => {
  const group = await start()
  await correctTransferMovement(await correction(group, { fromAccountId: third, toAccountId: from, amount: 10 }))
  expect(await balance()).toBe(110); expect(await balance(to)).toBe(50); expect(await balance(third)).toBe(60)
  const pair = resolveTransferPair(await db.transactions.toArray())
  expect(pair.outgoing.context).toBe('personal'); expect(pair.incoming.context).toBe('dfl')
})
test('stale correction is rejected with balances and queue preserved', async () => {
  const group = await start(), stale = await correction(group)
  await correctTransferMovement({ ...stale, amount: 40 })
  const queue = await db.syncQueue.toArray()
  await expect(correctTransferMovement(stale)).rejects.toThrow('mudou')
  expect(await balance()).toBe(60); expect(await db.syncQueue.toArray()).toEqual(queue)
})
test('failed second leg rolls back every account, ledger row and queue revision', async () => {
  const group = await start(), input = await correction(group)
  const before = await db.transactions.toArray(), queue = await db.syncQueue.toArray()
  const original = db.transactions.put.bind(db.transactions)
  let calls = 0
  const spy = jest.spyOn(db.transactions, 'put').mockImplementation(((...args: any[]) => {
    if (++calls === 2) return Promise.reject(new Error('disk failure'))
    return (original as any)(...args)
  }) as any)
  await expect(correctTransferMovement(input)).rejects.toThrow('disk failure'); spy.mockRestore()
  expect(await balance()).toBe(80); expect(await balance(to)).toBe(70)
  expect(await db.transactions.toArray()).toEqual(before); expect(await db.syncQueue.toArray()).toEqual(queue)
})
test('cancel entire movement and retry never restores twice', async () => {
  const group = await start(), expected = await revision()
  await cancelTransferMovement(uid, group, expected); await cancelTransferMovement(uid, group, expected)
  expect(await balance()).toBe(100); expect(await balance(to)).toBe(50)
  expect(await db.transactions.count()).toBe(0)
  const deletions = await db.syncQueue.filter(row => row.table === 'transactions').toArray()
  expect(deletions).toHaveLength(2); expect(deletions.every(row => row.operation === 'delete')).toBe(true)
})
test('lost create response followed by cancel reuses original outbox then sends balanced deletion', async () => {
  const group = await start()
  rpc.mockResolvedValueOnce({ error: { message: 'lost response' }, data: null })
  await pushAtomicFinancialBatch(uid, true, () => true)
  const first = structuredClone(rpc.mock.calls[0][1])
  await cancelTransferMovement(uid, group, await revision())
  rpc.mockImplementation(reply)
  await pushAtomicFinancialBatch(uid, true, () => true)
  expect(rpc.mock.calls[1][1]).toEqual(first)
  expect(await balance()).toBe(100); expect(await balance(to)).toBe(50)
  await pushAtomicFinancialBatch(uid, true, () => true)
  const items = rpc.mock.calls[2][1].p_items
  expect(items.filter((row: any) => row.table === 'transactions').every((row: any) => row.operation === 'delete' && row.expected_updated_at)).toBe(true)
  expect(await db.syncQueue.count()).toBe(0)
})
test('foreign destination and incomplete legacy direction cannot move cash', async () => {
  const group = await start()
  await db.accounts.update(third, { user_id: randomUUID() })
  await expect(correctTransferMovement(await correction(group, { toAccountId: third }))).rejects.toThrow('usuário')
  const pair = resolveTransferPair(await db.transactions.toArray())
  await db.transactions.update(pair.incoming.id, { transfer_direction: undefined })
  await expect(cancelTransferMovement(uid, group, await revision())).rejects.toThrow('verificáveis')
  expect(await balance()).toBe(80)
})
test('future automation needs review; future confirmed manual belongs to planning; cards/contracts excluded', () => {
  expect(belongsInFinancialInbox(tx({ source: 'whatsapp', date: '2026-11-10' }), date)).toBe(true)
  expect(belongsInFinancialInbox(tx({ date: '2026-11-10' }), date)).toBe(false)
  for (const patch of [{ credit_card_id: 'card' }, { financing_id: 'contract' }, { loan_id: 'loan' }, { debt_id: 'debt' }, { goal_id: 'goal' }, { transfer_group_id: 'group' }]) {
    expect(belongsInFinancialInbox(tx(patch), date)).toBe(false)
  }
  expect(belongsInFinancialInbox(tx({ date: '2026-02-30' }), date)).toBe(true)
  expect(belongsInFinancialInbox(tx({ date: '2026-11-10', due_date: date }), date)).toBe(true)
})
test('review persists provenance and removes a future item from inbox without applying balance', async () => {
  const row = tx({ source: 'whatsapp', date: '2026-11-10' }); await db.transactions.add(row)
  await saveConciliationReview(uid, row.id, { description: 'Confirmada', amount: 20, date: row.date, account_id: from })
  const current = await db.transactions.get(row.id)
  expect(current?.source).toBe('whatsapp'); expect(current?.reviewed_at).toBeTruthy()
  expect(needsFinancialReview(current)).toBe(false); expect(belongsInFinancialInbox(current, date)).toBe(false)
  expect(current?.status).toBe('pending'); expect(await balance()).toBe(100)
})
test('ordinary settlement uses serialized fresh state and duplicate tap does not debit twice', async () => {
  const row = tx(); await db.transactions.add(row)
  await Promise.all([conciliatePendingTransaction(uid, row.id), conciliatePendingTransaction(uid, row.id)])
  expect(await balance()).toBe(80); expect((await db.transactions.get(row.id))?.status).toBe('done')
})
test('card, ambiguous legacy pending and invalid civil date cannot settle cash', async () => {
  for (const patch of [{ credit_card_id: randomUUID() }, { affects_balance: true }, { date: '2026-02-30' }, { date: '2027-11-10' }, { amount: 0.001 }]) {
    const row = tx(patch); await db.transactions.add(row)
    await expect(conciliatePendingTransaction(uid, row.id)).rejects.toThrow()
  }
  expect(await balance()).toBe(100); expect(await db.syncQueue.count()).toBe(0)
})
test.each(['outubr', 'outubro', 'outubro 2026', 'OUT/26', '10/2026'])('date parser recognizes %s as October', query => {
  expect(parseDateIntent(query, new Date('2026-10-09T12:00:00'))).toMatchObject({ start: '2026-10-01', end: '2026-10-31' })
})
test.each(['NOV/26', 'novembro de 2026'])('date parser recognizes %s as November', query => {
  expect(parseDateIntent(query)).toMatchObject({ start: '2026-11-01', end: '2026-11-30' })
})
test('full year and literal dates have a date intent; invalid day does not roll forward', () => {
  expect(parseDateIntent('2026 completo')).toMatchObject({ start: '2026-01-01', end: '2026-12-31' })
  expect(parseDateIntent('09/10/2026')).toMatchObject({ start: date, end: date })
  expect(parseDateIntent('2026-10-09')).toMatchObject({ start: date, end: date })
  expect(parseDateIntent('30/02/2026')).toBeNull()
})
test('InfinitePay precision suppresses fuzzy alternatives; money has no substring false positives', async () => {
  await db.transactions.bulkAdd([tx({ description: 'Venda exata', amount: 100 }), tx({ description: 'InfinitePai', account_id: to, amount: 1100 }), tx({ description: 'Pessoal', context: 'personal', account_id: third, amount: 100 })])
  const results = await searchFinancialData(uid, 'dfl', 'InfinitePay')
  expect(results.map(row => row.title)).toContain('Venda exata')
  expect(results.map(row => row.title)).not.toContain('InfinitePai')
  const money = await searchFinancialData(uid, 'dfl', 'R$ 100,00')
  expect(money.filter(row => row.kind === 'transaction').map(row => row.title)).toEqual(['Venda exata'])
})
test('date search uses ledger dates, not account modification timestamps, and groups transfers once', async () => {
  await start(); await db.transactions.add(tx({ date: '2025-10-09' }))
  const results = await searchFinancialData(uid, 'dfl', '2026 completo')
  expect(results).toHaveLength(1); expect(results[0].transactionType).toBe('transfer')
  expect(results[0].title).toBe('Transferência')
})
test('commands only return reviewed navigation targets and never mutate ledger', async () => {
  expect(resolveFinancialCommands('transferência')[0].href).toBe('/transactions?action=transfer')
  expect(resolveFinancialCommands('nova despesa')[0].href).toContain('type=expense')
  expect(resolveFinancialCommands('pague o fornecedor')).toEqual([])
  expect(await db.transactions.count()).toBe(0); expect(await db.syncQueue.count()).toBe(0)
})
test('full recovery snapshot preserves both contexts, cross-context legs, exact queue and outbox', async () => {
  await transferBetweenAccounts({ userId: uid, fromAccountId: from, toAccountId: third, amount: 20, operationId: randomUUID() })
  rpc.mockResolvedValueOnce({ error: { message: 'lost response' }, data: null })
  await pushAtomicFinancialBatch(uid, true, () => true)
  const backup = await createRecoveryBackup(uid, 'dfl')
  expect(backup.version).toBe(2); expect(backup.tables.transactions).toHaveLength(2)
  expect(new Set(backup.tables.transactions.map(row => row.context)).size).toBe(2)
  expect(backup.syncQueue).toEqual(await db.syncQueue.where('user_id').equals(uid).toArray())
  expect(backup.financialOutbox).toEqual([await db.financialOutbox.get(uid)])
  expect(validateRecoveryBackup(backup, uid, 'personal')).toBe(backup)
  await expect(restoreRecoveryBackup(backup, uid, 'dfl')).rejects.toThrow('bloqueada')
  expect(await balance()).toBe(80); expect(await db.transactions.count()).toBe(2)
})
test('backup validation rejects foreign owner and duplicate IDs without importing data', async () => {
  const backup = await createRecoveryBackup(uid, 'dfl')
  expect(() => validateRecoveryBackup({ ...backup, user_id: randomUUID() }, uid, 'dfl')).toThrow('usuário')
  backup.tables.accounts.push(backup.tables.accounts[0])
  expect(() => validateRecoveryBackup(backup, uid, 'dfl')).toThrow('Registro inválido')
  expect(await db.accounts.count()).toBe(3)
})
test('opening legacy future inspection does not reverse a legitimate advance payment', async () => {
  const row = tx({ recurring_group_id: randomUUID(), date: '2027-11-01', status: 'done', affects_balance: true })
  await db.transactions.add(row)
  const result = await repairFutureScheduledTransactions(uid)
  expect(result.repairedTransactions).toBe(0); expect(result.requiresReview).toBe(1)
  expect((await db.transactions.get(row.id))?.status).toBe('done'); expect(await balance()).toBe(100)
  expect(await db.syncQueue.count()).toBe(0)
})
test('stale generic editor rejects a same-millisecond financial change but ignores sync metadata', () => {
  const row = tx()
  expect(() => assertTransactionUnchanged(row, { ...row, amount: 50 }, uid)).toThrow('mudou')
  expect(() => assertTransactionUnchanged(row, { ...row, sync_status: 'pending', _sync_base: { updated_at: version } }, uid)).not.toThrow()
})
test('empty queue is not a claim of runtime verification; preserved outbox and conflicts remain visible', () => {
  const base = { online: true, pending: 0, hasOutbox: false, lastSuccess: null, lastError: null }
  expect(syncSafetyStatus(base).kind).toBe('unverified')
  expect(syncSafetyStatus({ ...base, lastSuccess: version }).kind).toBe('verified')
  expect(syncSafetyStatus({ ...base, lastSuccess: version, hasOutbox: true }).kind).toBe('pending')
  expect(syncFailurePresentation('DFL_SYNC_CONFLICT:accounts/id')?.kind).toBe('conflict')
  expect(syncFailurePresentation('PGRST202 Could not find function')?.kind).toBe('backend')
  expect(syncFailurePresentation('DFL_LEGACY_REVIEW')?.kind).toBe('legacy')
})
