// src/lib/accountOperations.ts

import { addToSyncQueue, db } from '@/lib/db'

type AccountContext = 'dfl' | 'personal'

interface TransferBetweenAccountsInput {
  userId: string
  fromAccountId: string
  toAccountId: string
  amount: number
  description?: string
}

interface AdjustAccountBalanceInput {
  userId: string
  accountId: string
  amount: number
  description?: string
}

function safeNumber(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function accountContext(value: unknown): AccountContext {
  return value === 'personal' ? 'personal' : 'dfl'
}

export async function transferBetweenAccounts({
  userId,
  fromAccountId,
  toAccountId,
  amount,
  description,
}: TransferBetweenAccountsInput): Promise<void> {
  if (!userId) {
    throw new Error('Usuário não autenticado.')
  }

  if (!fromAccountId || !toAccountId) {
    throw new Error('Conta de origem ou destino inválida.')
  }

  if (fromAccountId === toAccountId) {
    throw new Error('As contas de origem e destino devem ser diferentes.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Informe um valor válido para transferência.')
  }

  const transferGroupId = crypto.randomUUID()
  const now = new Date().toISOString()
  const date = now.split('T')[0]

  await db.transaction(
    'rw',
    db.accounts,
    db.transactions,
    db.syncQueue,
    async () => {
      const fromAccount: any = await db.accounts.get(fromAccountId)
      const toAccount: any = await db.accounts.get(toAccountId)

      if (!fromAccount) {
        throw new Error('Conta de origem não encontrada.')
      }

      if (!toAccount) {
        throw new Error('Conta de destino não encontrada.')
      }

      if (
        fromAccount.user_id !== userId ||
        toAccount.user_id !== userId
      ) {
        throw new Error(
          'Conta de origem ou destino não pertence ao usuário.'
        )
      }

      const fromBalance = safeNumber(fromAccount.balance)
      const toBalance = safeNumber(toAccount.balance)

      const newFromBalance = fromBalance - amount
      const newToBalance = toBalance + amount

      const fromContext = accountContext(fromAccount.context)
      const toContext = accountContext(toAccount.context)

      const fromTx = {
        id: crypto.randomUUID(),
        user_id: userId,
        description:
          description?.trim() ||
          `Transferência para ${toAccount.name}`,
        amount,
        type: 'transfer',
        account_id: fromAccount.id,
        transfer_to: toAccount.id,
        transfer_group_id: transferGroupId,
        date,
        status: 'done',
        context: fromContext,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
        sync_attempts: 0,
      }

      const toTx = {
        id: crypto.randomUUID(),
        user_id: userId,
        description:
          description?.trim() ||
          `Transferência de ${fromAccount.name}`,
        amount,
        type: 'transfer',
        account_id: toAccount.id,
        transfer_from: fromAccount.id,
        transfer_group_id: transferGroupId,
        date,
        status: 'done',
        context: toContext,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
        sync_attempts: 0,
      }

      await db.accounts.update(fromAccount.id, {
        balance: newFromBalance,
        updated_at: now,
        sync_status: 'pending',
      })

      await addToSyncQueue(
        userId,
        'accounts',
        'update',
        fromAccount.id,
        {
          ...fromAccount,
          balance: newFromBalance,
          updated_at: now,
          sync_status: 'pending',
        }
      )

      await db.accounts.update(toAccount.id, {
        balance: newToBalance,
        updated_at: now,
        sync_status: 'pending',
      })

      await addToSyncQueue(
        userId,
        'accounts',
        'update',
        toAccount.id,
        {
          ...toAccount,
          balance: newToBalance,
          updated_at: now,
          sync_status: 'pending',
        }
      )

      await db.transactions.add(fromTx as any)
      await addToSyncQueue(
        userId,
        'transactions',
        'create',
        fromTx.id,
        fromTx
      )

      await db.transactions.add(toTx as any)
      await addToSyncQueue(
        userId,
        'transactions',
        'create',
        toTx.id,
        toTx
      )
    }
  )
}

export async function adjustAccountBalance({
  userId,
  accountId,
  amount,
  description,
}: AdjustAccountBalanceInput): Promise<number> {
  if (!userId) {
    throw new Error('Usuário não autenticado.')
  }

  if (!accountId) {
    throw new Error('Conta não identificada.')
  }

  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error('Informe um valor válido para ajuste.')
  }

  const now = new Date().toISOString()
  const date = now.split('T')[0]
  let newBalance = 0

  await db.transaction(
    'rw',
    db.accounts,
    db.transactions,
    db.syncQueue,
    async () => {
      const account: any = await db.accounts.get(accountId)

      if (!account) {
        throw new Error('Conta não encontrada.')
      }

      if (account.user_id !== userId) {
        throw new Error('Esta conta não pertence ao usuário.')
      }

      newBalance = safeNumber(account.balance) + amount

      const updatedAccount = {
        ...account,
        balance: newBalance,
        updated_at: now,
        sync_status: 'pending',
      }

      const transaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        description: description?.trim() || 'Ajuste de saldo',
        amount: Math.abs(amount),
        type: amount > 0 ? 'income' : 'expense',
        account_id: account.id,
        date,
        status: 'done',
        context: accountContext(account.context),
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
        sync_attempts: 0,
      }

      await db.accounts.update(account.id, {
        balance: newBalance,
        updated_at: now,
        sync_status: 'pending',
      })

      await addToSyncQueue(
        userId,
        'accounts',
        'update',
        account.id,
        updatedAccount
      )

      await db.transactions.add(transaction as any)
      await addToSyncQueue(
        userId,
        'transactions',
        'create',
        transaction.id,
        transaction
      )
    }
  )

  return newBalance
}
