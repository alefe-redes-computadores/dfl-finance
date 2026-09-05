// src/lib/debtCreditOperations.ts
import { addToSyncQueue, db } from '@/lib/db'
import type { LocalDebt, LocalTransaction } from '@/lib/db'
import {
  getContactCreditLedgerBalance,
  getDebtPaymentAppliedAmount,
} from '@/lib/contactOperations'
import { getDebtStatusFromAmounts, isDebtPayment } from '@/lib/debtOperations'

const cents = (value: unknown) => Math.max(0, Math.round(Number(value || 0) * 100))
const signedCents = (value: unknown) => Math.round(Number(value || 0) * 100)
const amount = (value: number) => value / 100

async function userTransactions(userId: string) {
  return db.transactions.where('user_id').equals(userId).toArray()
}

async function debtPayments(userId: string, debtId: string) {
  return db.transactions
    .where('[user_id+debt_id]')
    .equals([userId, debtId])
    .filter((tx) => isDebtPayment(tx))
    .toArray()
}

function paidCents(items: LocalTransaction[], excludeId?: string) {
  return items.reduce((sum, tx) => {
    if (excludeId && tx.id === excludeId) return sum
    return sum + cents(getDebtPaymentAppliedAmount(tx))
  }, 0)
}

export async function applyContactCreditToDebt({
  userId,
  debtId,
  requestedAmount,
  date,
}: {
  userId: string
  debtId: string
  requestedAmount?: number
  date?: string
}) {
  const debt = await db.debts.get(debtId)
  if (!debt || debt.user_id !== userId) throw new Error('Cobrança não encontrada.')
  if (!debt.contact_id) throw new Error('Esta cobrança não está vinculada a um contato.')
  if (debt.status === 'cancelled') throw new Error('Cobrança cancelada não pode receber crédito.')

  const [allTx, payments] = await Promise.all([userTransactions(userId), debtPayments(userId, debtId)])
  const creditCents = Math.max(0, signedCents(getContactCreditLedgerBalance(debt.contact_id, allTx)))
  const totalCents = cents(debt.total_amount)
  const alreadyPaid = paidCents(payments)
  const remainingCents = Math.max(0, totalCents - alreadyPaid)
  const requestedCents = requestedAmount == null ? creditCents : cents(requestedAmount)
  const appliedCents = Math.min(creditCents, remainingCents, requestedCents)

  if (appliedCents <= 0) throw new Error('Não há crédito disponível para aplicar nesta cobrança.')

  const now = new Date().toISOString()
  const txId = crypto.randomUUID()
  const nextPaid = Math.min(totalCents, alreadyPaid + appliedCents)
  const tx: LocalTransaction = {
    id: txId,
    user_id: userId,
    context: debt.context,
    type: 'income',
    amount: 0,
    description: 'Crédito aplicado',
    date: date || now.slice(0, 10),
    status: 'done',
    affects_balance: false,
    category_id: debt.category_id || null,
    account_id: null,
    contact_id: debt.contact_id,
    debt_id: debt.id,
    debt_applied_amount: amount(appliedCents),
    contact_credit_delta: -amount(appliedCents),
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
    sync_attempts: 0,
  }
  const updatedDebt: LocalDebt = {
    ...debt,
    paid_amount: amount(nextPaid),
    status: getDebtStatusFromAmounts(totalCents, nextPaid),
    updated_at: now,
    sync_status: 'pending',
  }

  await db.transaction('rw', db.transactions, db.debts, db.syncQueue, async () => {
    await db.transactions.add(tx)
    await db.debts.put(updatedDebt)
    await addToSyncQueue(userId, 'transactions', 'create', txId, tx)
    await addToSyncQueue(userId, 'debts', 'update', debt.id, updatedDebt)
  })

  return { applied: amount(appliedCents), remainingCredit: amount(creditCents - appliedCents) }
}

export async function assertCreditSourceCanBeRemoved(userId: string, tx: LocalTransaction) {
  const generatedCents = Math.max(0, signedCents(tx.contact_credit_delta))
  if (generatedCents <= 0 || !tx.contact_id) return

  const allTx = await userTransactions(userId)
  const currentCreditCents = signedCents(getContactCreditLedgerBalance(tx.contact_id, allTx))
  if (currentCreditCents < generatedCents) {
    const used = amount(generatedCents - Math.max(currentCreditCents, 0))
    throw new Error(
      `${used.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} deste recebimento já foram usados como crédito. Desfaça primeiro a aplicação do crédito.`
    )
  }
}

export async function deleteDebtPaymentWithCreditSafety({
  userId,
  transactionId,
}: {
  userId: string
  transactionId: string
}) {
  const tx = await db.transactions.get(transactionId)
  if (!tx || tx.user_id !== userId || !isDebtPayment(tx) || !tx.debt_id) {
    throw new Error('Recebimento não encontrado.')
  }
  await assertCreditSourceCanBeRemoved(userId, tx)

  const debt = await db.debts.get(tx.debt_id)
  if (!debt || debt.user_id !== userId) throw new Error('Cobrança vinculada não encontrada.')
  const payments = await debtPayments(userId, debt.id)
  const totalCents = cents(debt.total_amount)
  const nextPaid = Math.min(totalCents, paidCents(payments, tx.id))
  const now = new Date().toISOString()

  const tables: any[] = [db.transactions, db.debts, db.syncQueue]
  let account: any = null
  if (tx.affects_balance !== false && tx.account_id) {
    account = await db.accounts.get(tx.account_id)
    if (!account || account.user_id !== userId) throw new Error('Conta do recebimento não encontrada.')
    tables.push(db.accounts)
  }

  const updatedDebt: LocalDebt = {
    ...debt,
    paid_amount: amount(nextPaid),
    status: getDebtStatusFromAmounts(totalCents, nextPaid),
    updated_at: now,
    sync_status: 'pending',
  }

  await db.transaction('rw', tables, async () => {
    if (account) {
      const updatedAccount = {
        ...account,
        balance: Number(account.balance || 0) - Math.abs(Number(tx.amount || 0)),
        updated_at: now,
        sync_status: 'pending',
      }
      await db.accounts.put(updatedAccount)
      await addToSyncQueue(userId, 'accounts', 'update', account.id, updatedAccount)
    }
    await db.transactions.delete(tx.id)
    await db.debts.put(updatedDebt)
    await addToSyncQueue(userId, 'transactions', 'delete', tx.id, { id: tx.id, user_id: userId, deleted_at: now })
    await addToSyncQueue(userId, 'debts', 'update', debt.id, updatedDebt)
  })

  return { restoredCredit: Number(tx.contact_credit_delta || 0) < 0 ? Math.abs(Number(tx.contact_credit_delta)) : 0 }
}
