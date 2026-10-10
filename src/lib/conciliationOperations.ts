import { civilDate, civilISO } from '@/lib/financialForecast'
import { isInboxCandidate } from '@/lib/inboxPolicy'
import { addToSyncQueue, db } from '@/lib/db'

function safeAmount(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Informe um valor válido.')
  }
  const rounded = Math.round(parsed * 100) / 100
  if (rounded < 0.01) throw new Error('Informe um valor de pelo menos um centavo.')
  return rounded
}

function safeCivilDate(value: unknown) {
  const text = String(value || '').slice(0, 10)
  if (!civilDate(text)) {
    throw new Error('Informe uma data válida.')
  }
  return text
}

export interface ConciliationReviewPatch {
  description: string
  amount: number
  date: string
  account_id: string
  category_id?: string | null
}

export async function saveConciliationReview(
  userId: string,
  transactionId: string,
  patch: ConciliationReviewPatch
) {
  if (!userId || !transactionId) {
    throw new Error('Pendência inválida.')
  }

  return db.transaction('rw', db.transactions, db.accounts, db.categories, db.syncQueue, async () => {
    const tx = await db.transactions.get(transactionId)
    if (!tx || tx.user_id !== userId) {
      throw new Error('A transação não foi encontrada.')
    }
    if (tx.status !== 'pending') {
      throw new Error('Esta transação já foi concluída.')
    }

    if (!isInboxCandidate(tx)) throw new Error('Cartões, transferências e contratos devem ser revisados no fluxo de origem.')
    if (tx.affects_balance === true) throw new Error('Pendência antiga com efeito de saldo ambíguo. Preserve o registro para revisão.')
    const account = await db.accounts.get(patch.account_id)
    if (!account || account.user_id !== userId || account.context !== tx.context || account.is_archived) {
      throw new Error('Escolha uma conta válida para esta pendência.')
    }

    const categoryId = patch.category_id || null
    if (categoryId) {
      const category = await db.categories.get(categoryId)
      if (
        !category ||
        category.user_id !== userId ||
        category.context !== tx.context ||
        category.is_archived ||
        category.type !== (tx.type === 'income' ? 'income' : 'expense')
      ) {
        throw new Error('Escolha uma categoria válida.')
      }
    }

    const now = new Date().toISOString()
    const updated = {
      ...tx,
      description: String(patch.description || '').trim() || 'Transação sem descrição',
      amount: safeAmount(patch.amount),
      date: safeCivilDate(patch.date),
      ...(tx.due_date ? { due_date: safeCivilDate(patch.date) } : {}),
      account_id: account.id,
      category_id: categoryId,
      updated_at: now,
      reviewed_at: now,
      sync_status: 'pending' as const,
    }

    await db.transactions.put(updated)
    await addToSyncQueue(userId, 'transactions', 'update', updated.id, updated)
    return updated
  })
}

export async function conciliatePendingTransaction(
  userId: string,
  transactionId: string
) {
  if (!userId || !transactionId) {
    throw new Error('Pendência inválida.')
  }

  return db.transaction('rw', db.transactions, db.accounts, db.syncQueue, async () => {
    const tx = await db.transactions.get(transactionId)

    if (!tx || tx.user_id !== userId) {
      throw new Error('A transação não foi encontrada.')
    }

    if (tx.status !== 'pending') {
      return { alreadyDone: true, transaction: tx }
    }

    if (!isInboxCandidate(tx)) throw new Error('Use o fluxo de origem para cartões, transferências e contratos.')
    const due = safeCivilDate(tx.due_date || tx.date)
    if (due > civilISO(new Date())) throw new Error('Esta pendência é futura. Revise sem liquidar; o pagamento antecipado deve ser explícito no formulário completo.')
    if (tx.affects_balance === true) throw new Error('Pendência antiga com efeito de saldo ambíguo. Preserve o registro para revisão.')
    if (!tx.account_id) {
      throw new Error('Escolha uma conta antes de conciliar.')
    }

    const account = await db.accounts.get(tx.account_id)
    if (!account || account.user_id !== userId || account.context !== tx.context || account.is_archived) {
      throw new Error('A conta vinculada não está disponível.')
    }

    const amount = safeAmount(tx.amount)
    const shouldApplyBalance = true
    const now = new Date().toISOString()

    if (shouldApplyBalance) {
      const currentBalance = Number(account.balance)
      if (!Number.isFinite(currentBalance)) throw new Error('Saldo da conta inválido. Nenhuma alteração foi realizada.')
      const delta = tx.type === 'income' ? amount : -amount
      const updatedAccount = {
        ...account,
        balance: Math.round((currentBalance + delta) * 100) / 100,
        updated_at: now,
        sync_status: 'pending' as const,
      }

      await db.accounts.put(updatedAccount)
      await addToSyncQueue(userId, 'accounts', 'update', account.id, updatedAccount)
    }

    const updatedTransaction = {
      ...tx,
      status: 'done' as const,
      affects_balance: true,
      updated_at: now,
      sync_status: 'pending' as const,
    }

    await db.transactions.put(updatedTransaction)
    await addToSyncQueue(
      userId,
      'transactions',
      'update',
      tx.id,
      updatedTransaction
    )

    return {
      alreadyDone: false,
      appliedBalance: shouldApplyBalance,
      transaction: updatedTransaction,
    }
  })
}
