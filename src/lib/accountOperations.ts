// src/lib/accountOperations.ts

import { civilISO } from '@/lib/financialForecast'
import { financialOperationId } from '@/lib/financialSyncContract'
import { addToSyncQueue, db } from '@/lib/db'

type AccountContext = 'dfl' | 'personal'

interface TransferBetweenAccountsInput {
  userId: string
  fromAccountId: string
  toAccountId: string
  amount: number
  description?: string
  operationId?: string
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
  operationId,
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

  const transferGroupId = operationId ? financialOperationId(operationId) : crypto.randomUUID()
  amount = Math.round(amount * 100) / 100
  if (amount <= 0) throw new Error('Informe um valor de pelo menos um centavo.')
  const now = new Date().toISOString()
  const date = civilISO(new Date())

  await db.transaction(
    'rw',
    db.accounts,
    db.transactions,
    db.syncQueue,
    async () => {
      const previous = await db.transactions.where('user_id').equals(userId)
        .filter(row => row.transfer_group_id === transferGroupId).toArray()
      if (previous.length) {
        const outgoing = previous.find(row => row.transfer_direction === 'out')
        const incoming = previous.find(row => row.transfer_direction === 'in')
        if (previous.length !== 2 || outgoing?.account_id !== fromAccountId ||
            incoming?.account_id !== toAccountId || outgoing.amount !== amount || incoming.amount !== amount) {
          throw new Error('Esta identidade já pertence a outra transferência.')
        }
        return
      }
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

      if (fromAccount.is_archived || toAccount.is_archived || !Number.isFinite(Number(fromAccount.balance)) || !Number.isFinite(Number(toAccount.balance))) throw new Error('Escolha contas ativas com saldos válidos.')
      const fromBalance = safeNumber(fromAccount.balance)
      const toBalance = safeNumber(toAccount.balance)

      const newFromBalance = (Math.round(fromBalance * 100) - Math.round(amount * 100)) / 100
      const newToBalance = (Math.round(toBalance * 100) + Math.round(amount * 100)) / 100

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
        to_account_id: toAccount.id,
        transfer_group_id: transferGroupId,

        /*
         * V55 — direção canônica da transferência.
         *
         * account_id continua representando a conta desta perna e
         * to_account_id a contraparte. O transfer_direction mantém a
         * direção explícita, independente do texto e da identidade UUID.
         */
        idempotency_key:
          financialOperationId(`${userId}:transfer:${transferGroupId}:out`),
        transfer_direction: 'out' as const,
        cash_delta: -amount,

        date,
        status: 'done',

        /*
         * O saldo das duas contas é atualizado diretamente
         * dentro desta mesma transação Dexie.
         *
         * A linha type=transfer é trilha/auditoria e não deve
         * ser interpretada como uma nova receita/despesa.
         */
        affects_balance: false,
        source: 'manual',

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
        to_account_id: fromAccount.id,
        transfer_group_id: transferGroupId,

        /*
         * Segunda perna do mesmo grupo.
         *
         * affects_balance=false permanece porque os saldos das
         * contas já são atualizados atomicamente nesta operação.
         */
        idempotency_key:
          financialOperationId(`${userId}:transfer:${transferGroupId}:in`),
        transfer_direction: 'in' as const,
        cash_delta: amount,

        date,
        status: 'done',
        affects_balance: false,
        source: 'manual',
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

  amount = Math.round(amount * 100) / 100
  if (amount === 0) throw new Error('Informe um ajuste de pelo menos um centavo.')
  const now = new Date().toISOString()
  const date = civilISO(new Date())
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

      newBalance = (Math.round(safeNumber(account.balance) * 100) + Math.round(amount * 100)) / 100

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
        affects_balance: false,
        cash_delta: amount,
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
