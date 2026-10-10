import { db, addToSyncQueue } from '@/lib/db'
import { findCompatibleCategory } from '@/lib/transactionCategoryOperations'

type CashContext = 'dfl' | 'personal'

/** Must run inside the caller's Dexie transaction (account + ledger + queue). */
export async function applyAccountCashDelta(
  userId: string, accountId: string, delta: number, context: CashContext
) {
  const account = await db.accounts.get(accountId)
  if (!account || account.user_id !== userId || account.is_archived) {
    throw new Error('A conta selecionada não está disponível.')
  }
  if ((account.context ?? 'dfl') !== context) {
    throw new Error('A conta não pertence ao contexto selecionado.')
  }
  if (!Number.isFinite(delta) || !Number.isFinite(Number(account.balance))) {
    throw new Error('Não foi possível validar o valor ou saldo da conta.')
  }
  const next = {
    ...account,
    balance: (Math.round(Number(account.balance) * 100) + Math.round(delta * 100)) / 100,
    updated_at: new Date().toISOString(),
    sync_status: 'pending' as const,
  }
  await db.accounts.update(accountId, next)
  await addToSyncQueue(userId, 'accounts', 'update', accountId, next)
}

export async function createQuickCashTransaction(input: {
  operationId: string
  userId: string
  context: CashContext
  type: 'income' | 'expense'
  amount: number
  accountId: string
  categoryId?: string | null
  date: string
}) {
  if (!input.userId || !input.accountId) throw new Error('Selecione uma conta para salvar.')
  const amount = Math.round(input.amount * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor válido.')

  return db.transaction('rw', db.accounts, db.categories, db.transactions, db.syncQueue, async () => {
    const existing = await db.transactions.get(input.operationId)
    if (existing) {
      if (existing.user_id !== input.userId || existing.account_id !== input.accountId ||
          existing.type !== input.type || existing.context !== input.context ||
          existing.amount !== amount || (existing.category_id ?? null) !== (input.categoryId || null) ||
          existing.date !== input.date) {
        throw new Error('Esta operação já foi usada para outro lançamento.')
      }
      return existing.id
    }
    const category = input.categoryId ? await db.categories.get(input.categoryId) : null
    if (input.categoryId && (category?.user_id !== input.userId || !findCompatibleCategory([category].filter(Boolean) as any[],
        input.categoryId, input.type, input.context) || category?.is_archived)) {
      throw new Error('Escolha uma categoria válida para este lançamento.')
    }
    const now = new Date().toISOString()
    await applyAccountCashDelta(input.userId, input.accountId,
      input.type === 'income' ? amount : -amount, input.context)
    const row = {
      id: input.operationId, idempotency_key: input.operationId, user_id: input.userId,
      context: input.context, type: input.type, amount, date: input.date,
      description: category?.name || (input.type === 'income' ? 'Receita rápida' : 'Despesa rápida'),
      category_id: input.categoryId || null, account_id: input.accountId,
      status: 'done' as const, affects_balance: true, source: 'manual' as const,
      created_at: now, updated_at: now, sync_status: 'pending' as const, sync_attempts: 0,
    }
    await db.transactions.add(row)
    await addToSyncQueue(input.userId, 'transactions', 'create', row.id, row)
    return row.id
  })
}
