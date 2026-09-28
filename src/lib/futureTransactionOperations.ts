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

const activeRepairs = new Map<
  string,
  Promise<{
    repairedTransactions: number
    repairedAccounts: number
    restoredNetAmount: number
  }>
>()

async function runFutureScheduledRepair(userId: string) {
  if (!userId) {
    return { repairedTransactions: 0, repairedAccounts: 0, restoredNetAmount: 0 }
  }

  const todayIso = todayLocalIso()
  const candidateIds = (
    await db.transactions.where('user_id').equals(userId).toArray()
  )
    .filter((tx) => isRepairableFutureScheduledTransaction(tx, todayIso))
    .map((tx) => tx.id)

  if (candidateIds.length === 0) {
    return { repairedTransactions: 0, repairedAccounts: 0, restoredNetAmount: 0 }
  }

  let repairedTransactions = 0
  let repairedAccounts = 0
  let restoredNetCents = 0

  await db.transaction(
    'rw',
    [db.accounts, db.transactions, db.syncQueue],
    async () => {
      /*
       * V61: o delta nasce SOMENTE após a releitura autoritativa.
       * Assim, duas chamadas que enxerguem o mesmo candidato fora
       * da transação não conseguem devolver o saldo duas vezes.
       */
      const committedDeltaCents = new Map<string, number>()
      const now = new Date().toISOString()

      for (const txId of candidateIds) {
        const fresh = await db.transactions.get(txId)

        if (
          !fresh ||
          fresh.user_id !== userId ||
          !isRepairableFutureScheduledTransaction(fresh, todayIso) ||
          !fresh.account_id
        ) {
          continue
        }

        const freshAccount = await db.accounts.get(fresh.account_id)
        if (!freshAccount || freshAccount.user_id !== userId) {
          throw new Error('Conta de um lançamento futuro não foi encontrada.')
        }

        const amountCents = cents(fresh.amount)
        const balanceDelta =
          fresh.type === 'income' ? -amountCents : amountCents

        committedDeltaCents.set(
          fresh.account_id,
          (committedDeltaCents.get(fresh.account_id) || 0) + balanceDelta
        )

        const updatedTransaction: LocalTransaction = {
          ...fresh,
          status: 'pending',
          affects_balance: false,
          updated_at: now,
          sync_status: 'pending',
        }

        await db.transactions.put(updatedTransaction)
        await addToSyncQueue(
          userId,
          'transactions',
          'update',
          fresh.id,
          updatedTransaction
        )
        repairedTransactions += 1
      }

      for (const [accountId, deltaCents] of Array.from(committedDeltaCents.entries())) {
        const freshAccount = await db.accounts.get(accountId)
        if (!freshAccount || freshAccount.user_id !== userId) {
          throw new Error('Conta de um lançamento futuro não foi encontrada.')
        }

        const updatedAccount: LocalAccount = {
          ...freshAccount,
          balance: money(cents(freshAccount.balance) + deltaCents),
          updated_at: now,
          sync_status: 'pending',
        }

        await db.accounts.put(updatedAccount)
        await addToSyncQueue(
          userId,
          'accounts',
          'update',
          accountId,
          updatedAccount
        )

        repairedAccounts += 1
        restoredNetCents += deltaCents
      }
    }
  )

  return {
    repairedTransactions,
    repairedAccounts,
    restoredNetAmount: money(restoredNetCents),
  }
}

export function repairFutureScheduledTransactions(userId: string) {
  /*
   * Single-flight por usuário: Transações e Detalhes da Conta
   * podem montar juntas, mas compartilham a mesma execução.
   */
  const running = activeRepairs.get(userId)
  if (running) return running

  const promise = runFutureScheduledRepair(userId).finally(() => {
    if (activeRepairs.get(userId) === promise) {
      activeRepairs.delete(userId)
    }
  })

  activeRepairs.set(userId, promise)
  return promise
}
