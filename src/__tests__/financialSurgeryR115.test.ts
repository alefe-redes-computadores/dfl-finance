/** @jest-environment node */
import 'fake-indexeddb/auto'
import { randomUUID, webcrypto } from 'node:crypto'

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() }
}))

import { db } from '@/lib/db'
import { transferBetweenAccounts } from '@/lib/accountOperations'
import {
  correctTransferMovement,
  cancelTransferMovement,
  resolveTransferPair,
  transferRevision,
} from '@/lib/transferMovementOperations'

const uid = randomUUID()
const from = randomUUID()
const to = randomUUID()
const third = randomUUID()
const stranger = randomUUID()
const epoch = '2026-10-01T12:00:00.000Z'

const account = (id: string, balance: number, user_id = uid) => ({
  id,
  user_id,
  context: 'dfl' as const,
  name: id,
  color: '#000000',
  balance,
  is_archived: false,
  created_at: epoch,
  updated_at: epoch,
  sync_status: 'synced' as const
})

const original = () => ({
  userId: uid,
  fromAccountId: from,
  toAccountId: to,
  amount: 20,
  operationId: randomUUID()
})

async function balances() {
  const rows = await Promise.all([
    db.accounts.get(from),
    db.accounts.get(to),
    db.accounts.get(third)
  ])
  return rows.map(row => {
    if (!row || !Number.isFinite(Number(row.balance))) {
      throw new Error('Conta de teste ausente ou saldo inválido')
    }
    return Number(row.balance)
  })
}

async function pairFor(groupId: string) {
  const rows = await db.transactions
    .where('user_id').equals(uid)
    .filter(row => row.transfer_group_id === groupId)
    .toArray()
  return resolveTransferPair(rows)
}

function correction(
  groupId: string,
  pair: Awaited<ReturnType<typeof pairFor>>,
  amount = 30,
  destination = to
) {
  return {
    userId: uid,
    groupId,
    expected: [
      transferRevision(pair.outgoing),
      transferRevision(pair.incoming)
    ],
    fromAccountId: from,
    toAccountId: destination,
    amount,
    date: '2026-10-24',
    description: 'Transferência revisada'
  }
}

beforeAll(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: webcrypto,
      configurable: true
    })
  }
})

beforeEach(async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
  await db.accounts.bulkAdd([
    account(from, 100),
    account(to, 50),
    account(third, 25),
    account(stranger, 500, randomUUID())
  ])
})

afterAll(async () => {
  await db.delete()
})

test('transferencia inicial preserva soma de saldos e duas pernas', async () => {
  const input = original()
  await transferBetweenAccounts(input)

  expect(await balances()).toEqual([80, 70, 25])
  expect((await balances()).reduce((a,b) => a + Number(b),0))
    .toBe(175)

  const pair = await pairFor(input.operationId)
  expect(pair.outgoing.amount).toBe(20)
  expect(pair.incoming.amount).toBe(20)
  expect(pair.outgoing.transfer_direction).toBe('out')
  expect(pair.incoming.transfer_direction).toBe('in')
})

test('repeticao da transferencia nao duplica saldo nem lancamentos', async () => {
  const input = original()

  await transferBetweenAccounts(input)
  const beforeQueue = await db.syncQueue.count()
  await transferBetweenAccounts(input)

  expect(await balances()).toEqual([80,70,25])
  expect(await db.transactions.count()).toBe(2)
  expect(await db.syncQueue.count()).toBe(beforeQueue)
})

test('correcao de valor preserva soma e par de transacoes', async () => {
  const input = original()
  await transferBetweenAccounts(input)

  const pair = await pairFor(input.operationId)
  const result = await correctTransferMovement(
    correction(input.operationId, pair)
  )

  expect(result.alreadyApplied).toBe(false)
  expect(await balances()).toEqual([70,80,25])
  expect(await db.transactions.count()).toBe(2)

  const updated = await pairFor(input.operationId)
  expect(updated.outgoing.amount).toBe(30)
  expect(updated.incoming.amount).toBe(30)
})

test('retry identico de correcao nao movimenta o caixa outra vez', async () => {
  const input = original()
  await transferBetweenAccounts(input)

  const pair = await pairFor(input.operationId)
  const command = correction(input.operationId, pair)

  await correctTransferMovement(command)
  const queueCount = await db.syncQueue.count()
  const result = await correctTransferMovement(command)

  expect(result.alreadyApplied).toBe(true)
  expect(await balances()).toEqual([70,80,25])
  expect(await db.syncQueue.count()).toBe(queueCount)
})

test('mudanca de conta de destino preserva todos os saldos', async () => {
  const input = original()
  await transferBetweenAccounts(input)

  const pair = await pairFor(input.operationId)
  await correctTransferMovement(
    correction(input.operationId, pair, 30, third)
  )

  expect(await balances()).toEqual([70,50,55])

  const updated = await pairFor(input.operationId)
  expect(updated.incoming.account_id).toBe(third)
  expect(updated.outgoing.to_account_id).toBe(third)
})

test('revisao antiga nao sobrescreve correcao concorrente', async () => {
  const input = original()
  await transferBetweenAccounts(input)

  const pair = await pairFor(input.operationId)
  const stale = correction(input.operationId, pair, 40)

  await correctTransferMovement(
    correction(input.operationId, pair, 30)
  )

  await expect(
    correctTransferMovement(stale)
  ).rejects.toThrow()

  expect(await balances()).toEqual([70,80,25])
})

test('conta de outro usuario nao recebe transferencia', async () => {
  const input = original()
  await transferBetweenAccounts(input)

  const pair = await pairFor(input.operationId)

  await expect(
    correctTransferMovement(
      correction(input.operationId, pair, 30, stranger)
    )
  ).rejects.toThrow()

  expect(await balances()).toEqual([80,70,25])
  expect((await db.accounts.get(stranger))?.balance).toBe(500)
})

test('falha durante correcao deixa contas e pernas intactas', async () => {
  const input = original()
  await transferBetweenAccounts(input)

  const pair = await pairFor(input.operationId)
  const before = await balances()
  const previous = await db.transactions.toArray()
  const queueCount = await db.syncQueue.count()

  const fault = jest.spyOn(db.transactions, 'put')
    .mockRejectedValueOnce(new Error('fault-injected'))

  try {
    await expect(
      correctTransferMovement(
        correction(input.operationId, pair, 30)
      )
    ).rejects.toThrow('fault-injected')
  } finally {
    fault.mockRestore()
  }

  expect(await balances()).toEqual(before)
  expect(await db.transactions.toArray()).toEqual(previous)
  expect(await db.syncQueue.count()).toBe(queueCount)
})

test('cancelamento reverte caixa e elimina as duas pernas', async () => {
  const input = original()
  await transferBetweenAccounts(input)

  const pair = await pairFor(input.operationId)

  await cancelTransferMovement(
    uid,
    input.operationId,
    [transferRevision(pair.outgoing), transferRevision(pair.incoming)]
  )

  expect(await balances()).toEqual([100,50,25])
  expect(await db.transactions.count()).toBe(0)
})

test('cancelamento repetido nao restaura saldo duas vezes', async () => {
  const input = original()
  await transferBetweenAccounts(input)

  const pair = await pairFor(input.operationId)
  const revisions = [
    transferRevision(pair.outgoing),
    transferRevision(pair.incoming)
  ]

  await cancelTransferMovement(uid, input.operationId, revisions)
  const result = await cancelTransferMovement(
    uid, input.operationId, revisions
  )

  expect(result.alreadyCancelled).toBe(true)
  expect(await balances()).toEqual([100,50,25])
})

test('transferencias simultaneas nao perdem atualizacoes', async () => {
  await Promise.all([
    transferBetweenAccounts({
      ...original(),
      operationId: randomUUID(),
      amount: 10
    }),
    transferBetweenAccounts({
      ...original(),
      operationId: randomUUID(),
      amount: 15
    })
  ])

  expect(await balances()).toEqual([75,75,25])
  expect(await db.transactions.count()).toBe(4)
})
