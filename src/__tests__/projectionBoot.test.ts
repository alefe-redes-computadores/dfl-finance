/** @jest-environment node */
import 'fake-indexeddb/auto'
jest.mock('@/lib/supabase', () => ({ supabase: {} }))
import { db } from '@/lib/db'
import { readProjectionRows } from '@/hooks/useProjection'
import { buildUnifiedCashProjection } from '@/lib/financialProjection'
beforeEach(async () => { await db.transaction('rw', db.tables, async () => { for (const table of db.tables) await table.clear() }) })
afterAll(async () => { await db.delete() })
test('projection boots against the actual schema with empty invoices', async () => {
  const rows = await readProjectionRows('user-a', 'personal')
  expect(rows).toEqual(Array.from({ length: 8 }, () => []))
  const [accounts, transactions, debts, creditCards, creditInvoices, loans, financings, subscriptions] = rows
  expect(buildUnifiedCashProjection({ context: 'personal', accounts, transactions, debts, creditCards, creditInvoices, loans, financings, subscriptions, categories: [] }).dailyProjection).toHaveLength(30)
})
test('invoice reading isolates owner and context and preserves local records', async () => {
  const invoice = (id: string, user_id: string, context: string) => ({ id, user_id, context, credit_card_id: 'card', status: 'open', total_amount: 80, paid_amount: 0, due_date: '2026-10-20', closing_date: '2026-10-10', sync_status: 'pending' })
  await db.credit_invoices.bulkAdd([invoice('own', 'user-a', 'personal'), invoice('company', 'user-a', 'dfl'), invoice('other-user', 'user-b', 'personal')] as any)
  const rows = await readProjectionRows('user-a', 'personal')
  expect(rows[4].map(row => row.id)).toEqual(['own'])
  expect(await db.credit_invoices.count()).toBe(3)
  expect((await db.credit_invoices.get('own'))?.sync_status).toBe('pending')
})
