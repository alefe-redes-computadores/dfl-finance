// src/lib/cardOperations.ts

import { format } from 'date-fns'
import { db, addToSyncQueue } from './db'

const safeNum = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const raw = String(value).trim()

  const normalized =
    raw.includes(',') && raw.includes('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(',', '.')

  const parsed = Number(normalized.replace(/[^0-9.-]+/g, ''))

  return Number.isFinite(parsed) ? parsed : 0
}

const parseLocalDate = (value: string | Date): Date => {
  if (value instanceof Date) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      12
    )
  }

  const [year, month, day] = String(value)
    .slice(0, 10)
    .split('-')
    .map(Number)

  if (!year || !month || !day) {
    throw new Error('Data da compra inválida')
  }

  return new Date(year, month - 1, day, 12)
}

const dateWithClampedDay = (
  year: number,
  month: number,
  day: number
): Date => {
  const maxDay = new Date(year, month + 1, 0, 12).getDate()

  return new Date(
    year,
    month,
    Math.min(Math.max(day, 1), maxDay),
    12
  )
}

export interface CardBillingCycle {
  startDate: string
  closingDate: string
  dueDate: string
}

export const resolveCardBillingCycle = (
  card: any,
  transactionDate: string | Date
): CardBillingCycle => {
  const reference = parseLocalDate(transactionDate)

  const closingDay = Math.min(
    Math.max(Number(card?.closing_day) || 1, 1),
    31
  )

  const dueDay = Math.min(
    Math.max(Number(card?.due_day) || 1, 1),
    31
  )

  let closing = dateWithClampedDay(
    reference.getFullYear(),
    reference.getMonth(),
    closingDay
  )

  if (reference.getTime() > closing.getTime()) {
    closing = dateWithClampedDay(
      reference.getFullYear(),
      reference.getMonth() + 1,
      closingDay
    )
  }

  const previousClosing = dateWithClampedDay(
    closing.getFullYear(),
    closing.getMonth() - 1,
    closingDay
  )

  const start = new Date(previousClosing)
  start.setDate(start.getDate() + 1)

  let due = dateWithClampedDay(
    closing.getFullYear(),
    closing.getMonth(),
    dueDay
  )

  if (due.getTime() <= closing.getTime()) {
    due = dateWithClampedDay(
      closing.getFullYear(),
      closing.getMonth() + 1,
      dueDay
    )
  }

  return {
    startDate: format(start, 'yyyy-MM-dd'),
    closingDate: format(closing, 'yyyy-MM-dd'),
    dueDate: format(due, 'yyyy-MM-dd'),
  }
}

export const getCardBillingCycleForMonth = (
  card: any,
  monthDate: Date
): CardBillingCycle => {
  const closingDay = Math.min(
    Math.max(Number(card?.closing_day) || 1, 1),
    31
  )

  const closing = dateWithClampedDay(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    closingDay
  )

  return resolveCardBillingCycle(card, closing)
}

export const isTransactionInCardCycle = (
  card: any,
  transactionDate: string,
  closingDate: string
): boolean => {
  if (!transactionDate || !closingDate) return false

  return (
    resolveCardBillingCycle(card, transactionDate).closingDate ===
    closingDate
  )
}

interface ReconcileCardInvoiceCycleInput {
  userId: string
  card: any
  transactionDate: string | Date
}

export async function reconcileCardInvoiceCycle({
  userId,
  card,
  transactionDate,
}: ReconcileCardInvoiceCycleInput): Promise<any | null> {
  if (!userId || !card?.id) {
    throw new Error('Cartão ou usuário não identificado')
  }

  if (card.user_id !== userId) {
    throw new Error(
      'Usuário não autorizado a acessar este cartão'
    )
  }

  const cycle = resolveCardBillingCycle(card, transactionDate)

  const cardTransactions: any[] = await db.transactions
    .where('[user_id+credit_card_id]')
    .equals([userId, card.id])
    .toArray()

  const openTransactions = cardTransactions.filter(
    (tx: any) =>
      tx.type === 'expense' &&
      tx.affects_balance !== true &&
      isTransactionInCardCycle(
        card,
        tx.date,
        cycle.closingDate
      )
  )

  const total = openTransactions.reduce(
    (sum: number, tx: any) =>
      sum + safeNum(tx.amount),
    0
  )

  const invoices: any[] = await db.credit_invoices
    .where('[user_id+credit_card_id]')
    .equals([userId, card.id])
    .toArray()

  let invoice: any = invoices.find(
    (item: any) =>
      item.closing_date === cycle.closingDate
  )

  if (invoice?.status === 'paid' && total > 0) {
    throw new Error(
      'Esta compra pertence a uma fatura que já foi paga. Altere a data da compra ou registre o ajuste em uma fatura aberta.'
    )
  }

  if (!invoice && total <= 0) {
    return null
  }

  const now = new Date().toISOString()

  if (!invoice) {
    invoice = {
      id: crypto.randomUUID(),
      user_id: userId,
      context: card.context,
      credit_card_id: card.id,

      amount: total,
      total_amount: total,

      start_date: cycle.startDate,
      end_date: cycle.closingDate,
      closing_date: cycle.closingDate,
      due_date: cycle.dueDate,

      status: 'open',

      created_at: now,
      updated_at: now,

      sync_status: 'pending',
      sync_attempts: 0,
    }

    await db.credit_invoices.add(invoice)

    await addToSyncQueue(
      userId,
      'credit_invoices',
      'create',
      invoice.id,
      invoice
    )
  } else {
    const updatedInvoice = {
      ...invoice,

      amount: total,
      total_amount: total,

      start_date: cycle.startDate,
      end_date: cycle.closingDate,
      closing_date: cycle.closingDate,
      due_date: cycle.dueDate,

      status: total > 0 ? 'open' : invoice.status,

      updated_at: now,
      sync_status: 'pending',
    }

    await db.credit_invoices.put(updatedInvoice)

    await addToSyncQueue(
      userId,
      'credit_invoices',
      'update',
      invoice.id,
      updatedInvoice
    )

    invoice = updatedInvoice
  }

  /*
   * Compatibilidade com histórico legado:
   * qualquer compra aberta pertencente ao ciclo passa a apontar
   * para a credit_invoice canônica.
   */
  for (const tx of openTransactions) {
    if (tx.invoice_id === invoice.id) {
      continue
    }

    const updatedTx = {
      ...tx,
      invoice_id: invoice.id,
      updated_at: now,
      sync_status: 'pending',
    }

    await db.transactions.put(updatedTx)

    await addToSyncQueue(
      userId,
      'transactions',
      'update',
      tx.id,
      updatedTx
    )
  }

  return invoice
}

interface PayCardInvoiceInput {
  userId: string
  cardId: string
  accountId: string
  transactionIds: string[]
}

interface PayCardInvoiceResult {
  totalPaid: number
  paymentTransactionId: string
  affectedTransactions: number
  newAccountBalance: number
  invoiceId: string | null
}

export async function payCardInvoice({
  userId,
  cardId,
  accountId,
  transactionIds,
}: PayCardInvoiceInput): Promise<PayCardInvoiceResult> {
  if (!userId) {
    throw new Error('Usuário não identificado')
  }

  if (!cardId) {
    throw new Error('Cartão não identificado')
  }

  if (!accountId) {
    throw new Error('Conta de pagamento não identificada')
  }

  const uniqueTransactionIds = Array.from(
    new Set(transactionIds.filter(Boolean))
  )

  if (uniqueTransactionIds.length === 0) {
    throw new Error(
      'Não existem compras abertas para pagar'
    )
  }

  return db.transaction(
    'rw',

    db.credit_cards,
    db.credit_invoices,
    db.accounts,
    db.transactions,
    db.syncQueue,

    async () => {
      const freshCard: any =
        await db.credit_cards.get(cardId)

      if (!freshCard) {
        throw new Error('Cartão não encontrado')
      }

      if (freshCard.user_id !== userId) {
        throw new Error(
          'Usuário não autorizado a acessar este cartão'
        )
      }

      const freshAccount: any =
        await db.accounts.get(accountId)

      if (!freshAccount) {
        throw new Error(
          'Conta de pagamento não encontrada'
        )
      }

      if (freshAccount.user_id !== userId) {
        throw new Error(
          'Usuário não autorizado a usar esta conta'
        )
      }

      /*
       * Os IDs enviados pela UI servem apenas para identificar
       * qual ciclo o usuário está pagando.
       *
       * A autoridade financeira continua aqui: relemos tudo
       * diretamente do Dexie.
       */
      const requested: any[] = []

      for (const transactionId of uniqueTransactionIds) {
        const tx: any =
          await db.transactions.get(transactionId)

        if (!tx) {
          continue
        }

        if (tx.user_id !== userId) {
          throw new Error(
            'Foi encontrada uma compra pertencente a outro usuário'
          )
        }

        if (tx.credit_card_id !== cardId) {
          throw new Error(
            'Foi encontrada uma compra pertencente a outro cartão'
          )
        }

        if (
          tx.type !== 'expense' ||
          tx.affects_balance === true
        ) {
          continue
        }

        requested.push(tx)
      }

      if (requested.length === 0) {
        throw new Error(
          'Esta fatura já foi paga ou não possui compras abertas'
        )
      }

      const targetCycle = resolveCardBillingCycle(
        freshCard,
        requested[0].date
      )

      if (
        requested.some(
          (tx) =>
            !isTransactionInCardCycle(
              freshCard,
              tx.date,
              targetCycle.closingDate
            )
        )
      ) {
        throw new Error(
          'As compras selecionadas pertencem a faturas diferentes'
        )
      }

      /*
       * Cria/reconcilia a fatura real antes de pagar.
       * Isso também incorpora compras antigas sem invoice_id.
       */
      const invoice = await reconcileCardInvoiceCycle({
        userId,
        card: freshCard,
        transactionDate: requested[0].date,
      })

      /*
       * Não confiamos na lista passada pela tela.
       * Pagamos TODAS as compras abertas pertencentes ao ciclo.
       */
      const allCardTransactions: any[] =
        await db.transactions
          .where('[user_id+credit_card_id]')
          .equals([userId, cardId])
          .toArray()

      const freshTransactions =
        allCardTransactions.filter(
          (tx: any) =>
            tx.type === 'expense' &&
            tx.affects_balance !== true &&
            isTransactionInCardCycle(
              freshCard,
              tx.date,
              targetCycle.closingDate
            )
        )

      if (freshTransactions.length === 0) {
        throw new Error(
          'Esta fatura já foi paga ou não possui compras abertas'
        )
      }

      const totalPaid = freshTransactions.reduce(
        (sum: number, tx: any) =>
          sum + safeNum(tx.amount),
        0
      )

      if (
        !Number.isFinite(totalPaid) ||
        totalPaid <= 0
      ) {
        throw new Error(
          'O valor da fatura é inválido'
        )
      }

      const now = new Date().toISOString()

      const newAccountBalance =
        safeNum(freshAccount.balance) - totalPaid

      const updatedAccount = {
        ...freshAccount,
        balance: newAccountBalance,
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

      const paymentTransactionId =
        crypto.randomUUID()

      const paymentTransaction = {
        id: paymentTransactionId,

        user_id: userId,

        type: 'expense',
        amount: totalPaid,

        description:
          `Pagamento fatura ${freshCard.name}`,

        account_id: accountId,
        credit_card_id: null,

        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'done',

        context:
          freshAccount.context ??
          freshCard.context,

        affects_balance: true,

        created_at: now,
        updated_at: now,

        sync_status: 'pending',
        sync_attempts: 0,
      }

      await db.transactions.add(
        paymentTransaction
      )

      await addToSyncQueue(
        userId,
        'transactions',
        'create',
        paymentTransactionId,
        paymentTransaction
      )

      for (const tx of freshTransactions) {
        const updatedTx = {
          ...tx,

          invoice_id:
            invoice?.id ??
            tx.invoice_id ??
            null,

          affects_balance: true,

          updated_at: now,
          sync_status: 'pending',
        }

        await db.transactions.put(updatedTx)

        await addToSyncQueue(
          userId,
          'transactions',
          'update',
          tx.id,
          updatedTx
        )
      }

      /*
       * Agora a entidade credit_invoice também acompanha
       * o pagamento real.
       */
      if (invoice) {
        const paidInvoice = {
          ...invoice,

          amount: totalPaid,
          total_amount: totalPaid,

          status: 'paid',
          paid_at: now,

          updated_at: now,
          sync_status: 'pending',
        }

        await db.credit_invoices.put(
          paidInvoice
        )

        await addToSyncQueue(
          userId,
          'credit_invoices',
          'update',
          invoice.id,
          paidInvoice
        )
      }

      return {
        totalPaid,
        paymentTransactionId,

        affectedTransactions:
          freshTransactions.length,

        newAccountBalance,

        invoiceId: invoice?.id ?? null,
      }
    }
  )
}
