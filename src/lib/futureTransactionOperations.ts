// src/lib/futureTransactionOperations.ts
import {
  addToSyncQueue,
  db,
} from '@/lib/db'
import type {
  LocalAccount,
  LocalTransaction,
} from '@/lib/db'

const cents = (value: unknown) =>
  Math.round(Number(value || 0) * 100)

const money = (valueInCents: number) =>
  valueInCents / 100

function todayLocalIso() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isRepairableFutureScheduledTransaction(
  tx: LocalTransaction,
  todayIso: string
) {
  return (
    /*
     * Qualquer ocorrência pertencente a uma série pode precisar
     * de reparo. Recorrências novas não usam total_installments.
     */
    Boolean(tx.recurring_group_id) &&
    String(tx.date || '') > todayIso &&
    tx.status === 'done' &&
    tx.affects_balance !== false &&
    Boolean(tx.account_id) &&
    !tx.credit_card_id &&
    (
      tx.type === 'income' ||
      tx.type === 'expense' ||
      tx.type === 'sangria'
    )
  )
}

export async function repairFutureScheduledTransactions(
  userId: string
) {
  if (!userId) {
    return {
      repairedTransactions: 0,
      repairedAccounts: 0,
      restoredNetAmount: 0,
    }
  }

  const todayIso = todayLocalIso()

  const candidates = (
    await db.transactions
      .where('user_id')
      .equals(userId)
      .toArray()
  ).filter((tx) =>
    isRepairableFutureScheduledTransaction(
      tx,
      todayIso
    )
  )

  if (candidates.length === 0) {
    return {
      repairedTransactions: 0,
      repairedAccounts: 0,
      restoredNetAmount: 0,
    }
  }

  const accountDeltaCents =
    new Map<string, number>()

  for (const tx of candidates) {
    if (!tx.account_id) continue

    const amountCents = cents(tx.amount)

    const balanceDelta =
      tx.type === 'income'
        ? -amountCents
        : amountCents

    accountDeltaCents.set(
      tx.account_id,
      (accountDeltaCents.get(tx.account_id) || 0) +
        balanceDelta
    )
  }

  const accountIds =
    Array.from(accountDeltaCents.keys())

  const accounts = (
    await Promise.all(
      accountIds.map((id) =>
        db.accounts.get(id)
      )
    )
  ).filter(Boolean) as LocalAccount[]

  const accountById = new Map(
    accounts.map((account) => [
      account.id,
      account,
    ])
  )

  for (const accountId of accountIds) {
    const account = accountById.get(accountId)

    if (
      !account ||
      account.user_id !== userId
    ) {
      throw new Error(
        'Conta de um lançamento futuro não foi encontrada.'
      )
    }
  }

  const now = new Date().toISOString()

  await db.transaction(
    'rw',
    [
      db.accounts,
      db.transactions,
      db.syncQueue,
    ],
    async () => {
      for (const tx of candidates) {
        const fresh =
          await db.transactions.get(tx.id)

        if (
          !fresh ||
          !isRepairableFutureScheduledTransaction(
            fresh,
            todayIso
          )
        ) {
          continue
        }

        const updatedTransaction: LocalTransaction = {
          ...fresh,
          status: 'pending',
          affects_balance: false,
          updated_at: now,
          sync_status: 'pending',
        }

        await db.transactions.put(
          updatedTransaction
        )

        await addToSyncQueue(
          userId,
          'transactions',
          'update',
          fresh.id,
          updatedTransaction
        )
      }

      for (
        const [accountId, deltaCents] of
        Array.from(
          accountDeltaCents.entries()
        )
      ) {
        const freshAccount =
          await db.accounts.get(accountId)

        if (
          !freshAccount ||
          freshAccount.user_id !== userId
        ) {
          throw new Error(
            'Conta de um lançamento futuro não foi encontrada.'
          )
        }

        const updatedAccount: LocalAccount = {
          ...freshAccount,
          balance: money(
            cents(freshAccount.balance) +
              deltaCents
          ),
          updated_at: now,
          sync_status: 'pending',
        }

        await db.accounts.put(
          updatedAccount
        )

        await addToSyncQueue(
          userId,
          'accounts',
          'update',
          accountId,
          updatedAccount
        )
      }
    }
  )

  const restoredNetCents =
    Array.from(
      accountDeltaCents.values()
    ).reduce(
      (sum, value) => sum + value,
      0
    )

  return {
    repairedTransactions:
      candidates.length,
    repairedAccounts:
      accountDeltaCents.size,
    restoredNetAmount:
      money(restoredNetCents),
  }
}
