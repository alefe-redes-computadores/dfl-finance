import { addToSyncQueue, db, type LocalFinancing, type LocalTransaction } from '@/lib/db'

type FinanceContext = 'dfl' | 'personal'

const moneyCents = (value: unknown) =>
  Math.max(0, Math.round(Number(value || 0) * 100))

const isoDay = (value?: string | null) => {
  const raw = String(value || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

const addMonthsCivil = (value: string, months: number) => {
  const [year, month, day] = value.split('-').map(Number)
  const target = new Date(year, month - 1 + months, 1)
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate()
  target.setDate(Math.min(day, lastDay))

  const yyyy = String(target.getFullYear()).padStart(4, '0')
  const mm = String(target.getMonth() + 1).padStart(2, '0')
  const dd = String(target.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const financingCount = (financing: LocalFinancing) =>
  Math.max(
    0,
    Number(
      financing.installments_count ||
        financing.total_installments ||
        0
    )
  )

const financingFirstDue = (financing: LocalFinancing) =>
  isoDay(financing.first_due_date) ||
  isoDay(financing.next_due_date) ||
  isoDay(financing.start_date) ||
  new Date().toISOString().slice(0, 10)

function installmentCents(
  totalCents: number,
  count: number,
  number: number
) {
  if (count <= 0) return 0
  const base = Math.floor(totalCents / count)
  const remainder = totalCents - base * count
  return base + (number <= remainder ? 1 : 0)
}

async function deleteQueuedTransaction(
  userId: string,
  tx: LocalTransaction
) {
  await db.transactions.delete(tx.id)
  await addToSyncQueue(
    userId,
    'transactions',
    'delete',
    tx.id,
    tx
  )
}

export async function assertFinancingStructureEditable(
  financingId: string,
  next: {
    totalAmount: number
    installmentsCount: number
    firstDueDate?: string | null
  }
) {
  const financing = await db.financings.get(financingId)
  if (!financing) throw new Error('Financiamento não encontrado.')

  const installments = await db.transactions
    .where('[user_id+financing_id]')
    .equals([financing.user_id, financingId])
    .toArray()

  const hasRealized = installments.some(
    (item) =>
      item.type === 'financing_installment' &&
      (item.paid === true || item.status === 'done')
  )

  if (!hasRealized) return

  const changed =
    moneyCents(financing.total_amount) !== moneyCents(next.totalAmount) ||
    financingCount(financing) !== Number(next.installmentsCount || 0) ||
    financingFirstDue(financing) !==
      (isoDay(next.firstDueDate) || financingFirstDue(financing))

  if (changed) {
    throw new Error(
      'Este financiamento já possui parcela paga. Valor total, quantidade de parcelas e primeiro vencimento ficam protegidos para preservar o histórico.'
    )
  }
}

export async function syncFinancingSchedule({
  userId,
  financingId,
  rewritePending = false,
}: {
  userId: string
  financingId: string
  rewritePending?: boolean
}) {
  const financing = await db.financings.get(financingId)
  if (!financing || financing.user_id !== userId) {
    throw new Error('Financiamento não encontrado.')
  }

  const count = financingCount(financing)
  if (count <= 0) return 0

  const totalCents = moneyCents(financing.total_amount)
  const firstDue = financingFirstDue(financing)
  const now = new Date().toISOString()

  return db.transaction(
    'rw',
    db.financings,
    db.transactions,
    db.syncQueue,
    async () => {
      let current = await db.transactions
        .where('[user_id+financing_id]')
        .equals([userId, financingId])
        .toArray()

      current = current.filter(
        (item) => item.type === 'financing_installment'
      )

      const realized = current.filter(
        (item) => item.paid === true || item.status === 'done'
      )

      if (rewritePending) {
        if (realized.length > 0) {
          throw new Error(
            'Parcelas já pagas impedem a reconstrução do cronograma.'
          )
        }

        for (const item of current) {
          await deleteQueuedTransaction(userId, item)
        }
        current = []
      }

      const existingNumbers = new Set(
        current.map(
          (item) =>
            Number(
              item.installment_number ||
                item.number ||
                0
            )
        )
      )

      const legacyStart = Math.max(
        1,
        Number(financing.current_installment || 1)
      )

      const firstNumber =
        current.length > 0
          ? 1
          : legacyStart

      const scheduleAnchor =
        current.length === 0 &&
        legacyStart > 1 &&
        isoDay(financing.next_due_date)
          ? isoDay(financing.next_due_date)!
          : firstDue

      let created = 0

      for (let number = firstNumber; number <= count; number += 1) {
        if (existingNumbers.has(number)) continue

        const dueDate = addMonthsCivil(
          scheduleAnchor,
          number - firstNumber
        )

        const cents = installmentCents(
          totalCents,
          count,
          number
        )

        const tx: LocalTransaction = {
          id: crypto.randomUUID(),
          user_id: userId,
          context:
            financing.context === 'personal'
              ? 'personal'
              : 'dfl',
          type: 'financing_installment',
          amount: cents / 100,
          description: `Parcela ${number}/${count} · ${
            financing.description ||
            financing.name ||
            'Financiamento'
          }`,
          date: dueDate,
          due_date: dueDate,
          status: 'pending',
          affects_balance: false,
          financing_id: financingId,
          installment_number: number,
          number,
          installment_index: number,
          total_installments: count,
          paid: false,
          paid_date: null,
          idempotency_key:
            `financing:${financingId}:installment:${number}`,
          source: 'manual',
          created_at: now,
          updated_at: now,
          sync_status: 'pending',
          sync_attempts: 0,
        }

        await db.transactions.add(tx)
        await addToSyncQueue(
          userId,
          'transactions',
          'create',
          tx.id,
          tx
        )
        created += 1
      }

      const all = await db.transactions
        .where('[user_id+financing_id]')
        .equals([userId, financingId])
        .toArray()

      const linked = all.filter(
        (item) => item.type === 'financing_installment'
      )
      const paidCents = linked.reduce(
        (sum, item) =>
          item.paid === true || item.status === 'done'
            ? sum + moneyCents(item.amount)
            : sum,
        0
      )
      const remainingCents = Math.max(0, totalCents - paidCents)
      const nextPending = linked
        .filter(
          (item) =>
            item.paid !== true && item.status !== 'done'
        )
        .sort((a, b) =>
          String(a.due_date || a.date).localeCompare(
            String(b.due_date || b.date)
          )
        )[0]

      const nextStatus: LocalFinancing['status'] =
        remainingCents <= 0
          ? 'paid'
          : financing.status === 'paid'
            ? 'active'
            : financing.status

      const updated = {
        ...financing,
        remaining_amount: remainingCents / 100,
        next_due_date:
          nextPending?.due_date ||
          nextPending?.date ||
          undefined,
        current_installment:
          nextPending
            ? Number(
                nextPending.installment_number ||
                  nextPending.number ||
                  1
              )
            : count,
        status: nextStatus,
        updated_at: now,
        sync_status: 'pending' as const,
      }

      await db.financings.update(financingId, updated)
      await addToSyncQueue(
        userId,
        'financings',
        'update',
        financingId,
        updated
      )

      return created
    }
  )
}

export async function settleLoanInFull({
  userId,
  loanId,
  accountId,
}: {
  userId: string
  loanId: string
  accountId: string
}) {
  if (!accountId) {
    throw new Error('Selecione a conta usada na quitação.')
  }

  return db.transaction(
    'rw',
    db.loans,
    db.accounts,
    db.transactions,
    db.syncQueue,
    async () => {
      const loan = await db.loans.get(loanId)
      const account = await db.accounts.get(accountId)

      if (!loan || loan.user_id !== userId) {
        throw new Error('Empréstimo não encontrado.')
      }
      if (!account || account.user_id !== userId) {
        throw new Error('Conta da quitação não encontrada.')
      }

      const payments = await db.transactions
        .where('[user_id+loan_id]')
        .equals([userId, loanId])
        .toArray()

      const alreadyPaidCents = payments
        .filter(
          (item) =>
            item.type === 'loan_payment' &&
            item.status === 'done'
        )
        .reduce(
          (sum, item) => sum + moneyCents(item.amount),
          0
        )

      const principalCents = moneyCents(loan.amount)
      const remainingCents = Math.max(
        0,
        principalCents - alreadyPaidCents
      )

      if (remainingCents <= 0) {
        const doneLoan = {
          ...loan,
          remaining_amount: 0,
          status: 'paid' as const,
          updated_at: new Date().toISOString(),
          sync_status: 'pending' as const,
        }
        await db.loans.update(loanId, doneLoan)
        await addToSyncQueue(
          userId,
          'loans',
          'update',
          loanId,
          doneLoan
        )
        return null
      }

      const payoffKey = `loan:${loanId}:payoff`
      const duplicate = payments.find(
        (item) => item.idempotency_key === payoffKey
      )
      if (duplicate) return duplicate.id

      const amount = remainingCents / 100
      const now = new Date().toISOString()
      const direction = loan.direction === 'borrowed' ? 'borrowed' : 'lent'
      const currentBalance = Number(account.balance || 0)
      const newBalance =
        direction === 'lent'
          ? currentBalance + amount
          : currentBalance - amount

      const updatedAccount = {
        ...account,
        balance: newBalance,
        updated_at: now,
        sync_status: 'pending' as const,
      }

      const payment: LocalTransaction = {
        id: crypto.randomUUID(),
        user_id: userId,
        context:
          loan.context === 'personal' ? 'personal' : 'dfl',
        type: 'loan_payment',
        amount,
        description: `Quitação · ${loan.description || 'Empréstimo'}`,
        date: now.slice(0, 10),
        status: 'done',
        affects_balance: false,
        account_id: accountId,
        loan_id: loanId,
        idempotency_key: payoffKey,
        source: 'manual',
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
        sync_attempts: 0,
      }

      const updatedLoan = {
        ...loan,
        remaining_amount: 0,
        status: 'paid' as const,
        updated_at: now,
        sync_status: 'pending' as const,
      }

      await db.accounts.update(accountId, updatedAccount)
      await addToSyncQueue(
        userId,
        'accounts',
        'update',
        accountId,
        updatedAccount
      )

      await db.transactions.add(payment)
      await addToSyncQueue(
        userId,
        'transactions',
        'create',
        payment.id,
        payment
      )

      await db.loans.update(loanId, updatedLoan)
      await addToSyncQueue(
        userId,
        'loans',
        'update',
        loanId,
        updatedLoan
      )

      return payment.id
    }
  )
}

export async function deleteLoanWithLedger({
  userId,
  loanId,
}: {
  userId: string
  loanId: string
}) {
  await db.transaction(
    'rw',
    db.loans,
    db.accounts,
    db.transactions,
    db.syncQueue,
    async () => {
      const loan = await db.loans.get(loanId)
      if (!loan || loan.user_id !== userId) {
        throw new Error('Empréstimo não encontrado.')
      }

      const payments = await db.transactions
        .where('[user_id+loan_id]')
        .equals([userId, loanId])
        .toArray()

      for (const payment of payments) {
        if (
          payment.type === 'loan_payment' &&
          payment.status === 'done' &&
          payment.account_id
        ) {
          const account = await db.accounts.get(payment.account_id)
          if (account && account.user_id === userId) {
            const amount = Number(payment.amount || 0)
            const currentBalance = Number(account.balance || 0)
            const reverted =
              loan.direction === 'borrowed'
                ? currentBalance + amount
                : currentBalance - amount
            const updatedAccount = {
              ...account,
              balance: reverted,
              updated_at: new Date().toISOString(),
              sync_status: 'pending' as const,
            }
            await db.accounts.update(account.id, updatedAccount)
            await addToSyncQueue(
              userId,
              'accounts',
              'update',
              account.id,
              updatedAccount
            )
          }
        }

        await deleteQueuedTransaction(userId, payment)
      }

      await db.loans.delete(loanId)
      await addToSyncQueue(
        userId,
        'loans',
        'delete',
        loanId,
        loan
      )
    }
  )
}
