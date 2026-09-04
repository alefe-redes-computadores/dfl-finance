// src/lib/contactOperations.ts
import type { LocalContact, LocalDebt, LocalTransaction } from '@/lib/db'
import { isDebtPayment } from '@/lib/debtOperations'

export type ContactEntityType = 'individual' | 'company'
export type ContactRelationshipType = 'customer' | 'supplier' | 'both' | 'other'

type ContactLike = Partial<LocalContact> & {
  type?: string | null
  entity_type?: string | null
  relationship_type?: string | null
}

const toMoney = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getContactEntityType(contact?: ContactLike | null): ContactEntityType {
  const explicit = contact?.entity_type
  if (explicit === 'company' || explicit === 'individual') return explicit

  if (contact?.type === 'company') return 'company'
  return 'individual'
}

export function getContactRelationshipType(
  contact?: ContactLike | null
): ContactRelationshipType {
  const explicit = contact?.relationship_type
  if (
    explicit === 'customer' ||
    explicit === 'supplier' ||
    explicit === 'both' ||
    explicit === 'other'
  ) {
    return explicit
  }

  if (
    contact?.type === 'customer' ||
    contact?.type === 'supplier' ||
    contact?.type === 'both'
  ) {
    return contact.type
  }

  return 'other'
}

export function getContactEntityLabel(contact?: ContactLike | null) {
  return getContactEntityType(contact) === 'company' ? 'Pessoa jurídica' : 'Pessoa física'
}

export function getContactRelationshipLabel(contact?: ContactLike | null) {
  switch (getContactRelationshipType(contact)) {
    case 'customer':
      return 'Cliente'
    case 'supplier':
      return 'Fornecedor'
    case 'both':
      return 'Cliente e fornecedor'
    default:
      return 'Contato'
  }
}

export function getContactRelationshipShortLabel(contact?: ContactLike | null) {
  switch (getContactRelationshipType(contact)) {
    case 'customer':
      return 'Cliente'
    case 'supplier':
      return 'Fornecedor'
    case 'both':
      return 'Ambos'
    default:
      return 'Contato'
  }
}

export function getDebtPaidAmount(
  debtId: string,
  transactions: LocalTransaction[]
) {
  return transactions.reduce((sum, tx) => {
    if (!isDebtPayment(tx) || tx.debt_id !== debtId) return sum
    return sum + Math.abs(toMoney(tx.amount))
  }, 0)
}

export function getDebtRemainingAmount(
  debt: Pick<LocalDebt, 'id' | 'total_amount' | 'status'>,
  transactions: LocalTransaction[]
) {
  if (debt.status === 'cancelled') return 0

  const total = Math.max(toMoney(debt.total_amount), 0)
  const paid = getDebtPaidAmount(debt.id, transactions)
  return Math.max(total - paid, 0)
}

export interface ContactFinancialSummary {
  transactionCount: number
  openDebtCount: number
  payable: number
  standaloneReceivable: number
  debtReceivable: number
  receivable: number
  received: number
  paid: number
}

export function getContactFinancialSummary({
  contactId,
  transactions,
  debts,
}: {
  contactId: string
  transactions: LocalTransaction[]
  debts: LocalDebt[]
}): ContactFinancialSummary {
  const contactTransactions = transactions.filter(
    (tx) => tx.contact_id === contactId
  )

  const contactDebts = debts.filter(
    (debt) => debt.contact_id === contactId && debt.status !== 'cancelled'
  )

  const standaloneReceivable = contactTransactions.reduce((sum, tx) => {
    if (
      tx.type === 'income' &&
      tx.status === 'pending' &&
      !tx.debt_id
    ) {
      return sum + Math.abs(toMoney(tx.amount))
    }
    return sum
  }, 0)

  const payable = contactTransactions.reduce((sum, tx) => {
    if (tx.type === 'expense' && tx.status === 'pending') {
      return sum + Math.abs(toMoney(tx.amount))
    }
    return sum
  }, 0)

  const debtReceivable = contactDebts.reduce(
    (sum, debt) => sum + getDebtRemainingAmount(debt, transactions),
    0
  )

  const openDebtCount = contactDebts.filter(
    (debt) => getDebtRemainingAmount(debt, transactions) > 0
  ).length

  const debtIds = new Set(contactDebts.map((debt) => debt.id))
  const receivedTransactionIds = new Set<string>()

  let received = 0

  for (const tx of transactions) {
    const isDirectReceived =
      tx.contact_id === contactId &&
      tx.type === 'income' &&
      tx.status === 'done'

    const isLinkedDebtPayment =
      Boolean(tx.debt_id) &&
      debtIds.has(tx.debt_id as string) &&
      isDebtPayment(tx)

    if ((isDirectReceived || isLinkedDebtPayment) && !receivedTransactionIds.has(tx.id)) {
      receivedTransactionIds.add(tx.id)
      received += Math.abs(toMoney(tx.amount))
    }
  }

  const paid = contactTransactions.reduce((sum, tx) => {
    if (tx.type === 'expense' && tx.status === 'done') {
      return sum + Math.abs(toMoney(tx.amount))
    }
    return sum
  }, 0)

  return {
    transactionCount: contactTransactions.length,
    openDebtCount,
    payable,
    standaloneReceivable,
    debtReceivable,
    receivable: standaloneReceivable + debtReceivable,
    received,
    paid,
  }
}

export function normalizeContactSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}
