/** @jest-environment node */
import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { webcrypto, randomUUID } from 'node:crypto'
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn() } }))
import { db, addToSyncQueue } from '@/lib/db'
import { createQuickCashTransaction } from '@/lib/cashOperations'
import { transferBetweenAccounts } from '@/lib/accountOperations'
import { pushAtomicFinancialBatch } from '@/lib/atomicFinancialSync'
import { sanitizeRemotePayload } from '@/lib/remoteSyncPayload'

import { transactionCashEffect } from '@/lib/financialSyncContract'
import { fetchRemoteSyncRows } from '@/lib/remoteSyncPages'
import { supabase } from '@/lib/supabase'
const rpc = supabase.rpc as jest.Mock
const uid = randomUUID(), from = randomUUID(), to = randomUUID()
const originalVersion = '2026-10-01T12:00:00.000Z'
const serverVersion = '2026-10-09T15:00:00.123456+00:00'
const account = (id: string, balance: number) => ({ id, user_id: uid, context: 'dfl' as const,
  name: id, color: '#000', balance, is_archived: false, created_at: originalVersion,
  updated_at: originalVersion, sync_status: 'synced' as const })
const cash = (operationId = randomUUID(), amount = 20) => ({ operationId, userId: uid,
  accountId: from, amount, context: 'dfl' as const, type: 'expense' as const, date: '2026-10-09' })
const response = (args: any) => ({ data: { status: 'committed', batch_id: args.p_batch_id,
  versions: Object.fromEntries(args.p_items.map((x: any) => [`${x.table}/${x.record_id}`,
    x.operation === 'delete' ? null : serverVersion])),
  accounts: Object.fromEntries(args.p_items.filter((x:any)=>x.table==='accounts').map((x:any)=>[x.record_id,
    x.operation==='delete'?null:{...x.data,updated_at:serverVersion}])) }, error: null })

beforeAll(() => { Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true }) })
beforeEach(async () => {
  rpc.mockReset()
  await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() })
  await db.accounts.bulkAdd([account(from, 100), account(to, 50)])
})
afterAll(async () => { await db.delete() })

test('failure after account update rolls back balance, ledger and queue', async () => {
  const fault = jest.spyOn(db.transactions, 'add').mockRejectedValueOnce(new Error('disk failure'))
  await expect(createQuickCashTransaction(cash())).rejects.toThrow('disk failure')
  fault.mockRestore()
  expect((await db.accounts.get(from))?.balance).toBe(100)
  expect(await db.transactions.count()).toBe(0)
  expect(await db.syncQueue.count()).toBe(0)
})

test('same quick operation retried does not debit twice', async () => {
  const input = cash()
  await createQuickCashTransaction(input)
  await createQuickCashTransaction(input)
  expect((await db.accounts.get(from))?.balance).toBe(80)
  expect(await db.transactions.count()).toBe(1)
  expect(await db.syncQueue.count()).toBe(2)
})

test('two quick operations re-read balance inside serialized transactions', async () => {
  await Promise.all([createQuickCashTransaction(cash(randomUUID(), 20)), createQuickCashTransaction(cash(randomUUID(), 30))])
  expect((await db.accounts.get(from))?.balance).toBe(50)
  expect(await db.transactions.count()).toBe(2)
  const row: any = await db.accounts.get(from)
  expect(row._sync_base.updated_at).toBe(originalVersion)
})

test('context mismatch cannot move money', async () => {
  await expect(createQuickCashTransaction({ ...cash(), context: 'personal' })).rejects.toThrow('contexto')
  expect((await db.accounts.get(from))?.balance).toBe(100)
  expect(await db.transactions.count()).toBe(0)
})

test('another user category is rejected before account effect', async () => {
  const id = randomUUID()
  await db.categories.add({ id, user_id: randomUUID(), context:'dfl', name:'Other', type:'expense',
    icon:'wallet', color:'#000', is_archived:false, created_at:originalVersion,
    updated_at:originalVersion, sync_status:'synced' })
  await expect(createQuickCashTransaction({ ...cash(), categoryId:id })).rejects.toThrow('categoria')
  expect((await db.accounts.get(from))?.balance).toBe(100)
})

test('transfer retry preserves two legs and both balances', async () => {
  const input={ userId:uid, fromAccountId:from, toAccountId:to, amount:20, operationId:randomUUID() }
  await transferBetweenAccounts(input)
  await transferBetweenAccounts(input)
  expect((await db.accounts.get(from))?.balance).toBe(80)
  expect((await db.accounts.get(to))?.balance).toBe(70)
  const rows=await db.transactions.toArray()
  expect(rows).toHaveLength(2)
  expect(rows.map(x=>x.transfer_direction).sort()).toEqual(['in','out'])
  expect(rows.every(x=>/^[0-9a-f-]{36}$/i.test(x.idempotency_key!))).toBe(true)
})

test('lost HTTP response preserves exact outbox despite a new local edit', async () => {
  await createQuickCashTransaction(cash())
  rpc.mockResolvedValueOnce({ data:null,error:{message:'lost response'} })
  expect(await pushAtomicFinancialBatch(uid,true,()=>true)).toBeGreaterThan(0)
  const firstArgs=structuredClone(rpc.mock.calls[0][1])
  expect(await db.financialOutbox.get(uid)).toBeTruthy()
  await createQuickCashTransaction(cash(randomUUID(),30))
  rpc.mockImplementationOnce((_name,args)=>Promise.resolve(response(args)))
  await pushAtomicFinancialBatch(uid,true,()=>true)
  expect(rpc.mock.calls[1][1]).toEqual(firstArgs)
  expect((await db.accounts.get(from))?.balance).toBe(50)
  const queued=await db.syncQueue.toArray()
  expect(queued).toHaveLength(2)
  expect(queued.find(x=>x.table==='accounts')?.operation).toBe('update')
  expect((await db.accounts.get(from) as any)._sync_base.updated_at).toBe(serverVersion)
  expect(await db.financialOutbox.get(uid)).toBeUndefined()
  rpc.mockImplementationOnce((_name,args)=>Promise.resolve(response(args)))
  await pushAtomicFinancialBatch(uid,true,()=>true)
  const secondArgs=rpc.mock.calls[2][1]
  expect(secondArgs.p_batch_id).not.toBe(firstArgs.p_batch_id)
  expect(secondArgs.p_items.find((x:any)=>x.table==='accounts').expected_updated_at).toBe(serverVersion)
  expect(await db.syncQueue.count()).toBe(0)
})

test('remote conflict preserves local balance, outbox and every queue revision', async () => {
  await createQuickCashTransaction(cash())
  rpc.mockResolvedValueOnce({data:null,error:{message:'DFL_SYNC_CONFLICT'}})
  await pushAtomicFinancialBatch(uid,true,()=>true)
  expect((await db.accounts.get(from))?.balance).toBe(80)
  expect(await db.syncQueue.count()).toBe(2)
  expect(await db.financialOutbox.get(uid)).toBeTruthy()
})

test('legacy pending without base is never guessed or consumed', async () => {
  await db.accounts.update(from,{balance:80,sync_status:'failed'})
  await addToSyncQueue(uid,'accounts','update',from,{...account(from,80),sync_status:'failed'})
  expect(await pushAtomicFinancialBatch(uid,true,()=>true)).toBeGreaterThan(0)
  expect(rpc).not.toHaveBeenCalled()
  expect((await db.accounts.get(from))?.balance).toBe(80)
  expect((await db.syncQueue.toArray())[0].last_error).toContain('DFL_LEGACY_REVIEW')
})

test('remote adapter namespaces legacy keys and removes local metadata', () => {
  const row={...cash(),idempotency_key:'transfer:example:out',type:'transfer',_sync_base:{updated_at:originalVersion}}
  const payload=sanitizeRemotePayload(row,randomUUID(),uid,'transactions')
  expect(payload.idempotency_key).toMatch(/^[0-9a-f-]{36}$/)
  expect(payload.transfer_direction).toBe('out')
  expect(payload).not.toHaveProperty('_sync_base')
})


test('remote additive rebase preserves a newer offline expense and updates its baseline', async () => {
  await createQuickCashTransaction(cash())
  rpc.mockImplementationOnce(async (_name,args)=> {
    await createQuickCashTransaction(cash(randomUUID(),30))
    const result=response(args)
    result.data.accounts[from].balance=70 // another client's -10, plus our -20
    return result
  })
  expect(await pushAtomicFinancialBatch(uid,true,()=>true)).toBe(0)
  const local:any=await db.accounts.get(from)
  expect(local.balance).toBe(40) // 70 remotely committed, minus newer local 30
  expect(local._sync_base.balance).toBe(70)
  expect(await db.syncQueue.count()).toBe(2)
  rpc.mockImplementationOnce((_name,args)=>Promise.resolve(response(args)))
  await pushAtomicFinancialBatch(uid,true,()=>true)
  const next=rpc.mock.calls[1][1].p_items.find((x:any)=>x.table==='accounts')
  expect(next.base_balance).toBe(70)
  expect(next.data.balance).toBe(40)
  expect(await db.syncQueue.count()).toBe(0)
})

test('cash contract distinguishes pending purchases, invoice settlement and lending directions', () => {
  const row={account_id:from,status:'done',amount:20}
  expect(transactionCashEffect({...row,type:'expense',affects_balance:false})).toBe(0)
  expect(transactionCashEffect({...row,type:'expense',affects_balance:false,invoice_id:randomUUID()})).toBe(-20)
  expect(transactionCashEffect({...row,type:'income',status:'pending'})).toBe(0)
  expect(transactionCashEffect({...row,type:'transfer',transfer_direction:'in'})).toBe(20)
  expect(transactionCashEffect({...row,type:'transfer'})).toBeNull()
  expect(transactionCashEffect({...row,type:'loan_payment',cash_delta:20})).toBe(20)
  expect(transactionCashEffect({...row,type:'loan_payment',cash_delta:-20})).toBe(-20)
  expect(transactionCashEffect({...row,type:'loan_payment'})).toBeNull()
})

test('pagination continues beyond a shortened page and fails on partial remote error', async () => {
  const ids=['a','b','c']
  const fromMock=supabase.from as jest.Mock
  let fail=false
  fromMock.mockImplementation(()=> {
    let after:string|null=null
    const builder:any={select:()=>builder,eq:()=>builder,order:()=>builder,limit:()=>builder,
      gte:()=>builder,gt:(_key:string,value:string)=>{after=value;return builder},
      then:(resolve:any)=>resolve(fail&&after==='a'?{data:null,error:{message:'network stopped'}}:
        {data:ids.filter(id=>after===null||id>after).slice(0,1).map(id=>({id})),error:null})}
    return builder
  })
  expect((await fetchRemoteSyncRows('transactions',uid)).map(x=>x.id)).toEqual(ids)
  fail=true
  await expect(fetchRemoteSyncRows('transactions',uid)).rejects.toThrow('network stopped')
})


test('actual app upgrade from IndexedDB v6 preserves account and pending queue', async () => {
  const schemas=Object.fromEntries(db.tables.filter(t=>t.name!=='financialOutbox').map(t=>
    [t.name,[t.schema.primKey.src,...t.schema.indexes.map(x=>x.src)].join(',')]))
  await db.delete()
  const legacy=new Dexie(db.name)
  legacy.version(6).stores(schemas)
  await legacy.table('accounts').add({...account(from,80),sync_status:'pending'})
  await legacy.table('syncQueue').add({id:randomUUID(),user_id:uid,table:'accounts',operation:'update',
    record_id:from,created_at:originalVersion,data:{...account(from,80),sync_status:'pending'},attempts:0})
  legacy.close()
  await db.open()
  expect(db.verno).toBe(7)
  expect((await db.accounts.get(from))?.balance).toBe(80)
  expect(await db.syncQueue.count()).toBe(1)
  expect(await db.financialOutbox.count()).toBe(0)
})
