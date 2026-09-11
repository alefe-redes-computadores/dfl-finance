// src/lib/importOperations.ts
import { addToSyncQueue, db, LocalTransaction } from '@/lib/db'

export type AccountImportSource = 'receipt' | 'csv'

export interface AccountImportItem {
  type: 'income' | 'expense'
  amount: number
  description: string
  date: string
  category_id?: string | null
  notes?: string | null
  receipt_url?: string | null
}

export interface ImportAccountTransactionsInput {
  userId: string
  context: 'dfl' | 'personal'
  accountId: string
  source: AccountImportSource
  transactions: AccountImportItem[]
}

export interface ImportAccountTransactionsResult {
  imported: number
  duplicates: number
  balanceDelta: number
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function moneyKey(value: unknown): string {
  return Math.round(Number(value || 0) * 100).toString()
}

export function buildImportTransactionSignature(
  transaction: Pick<
    LocalTransaction,
    'type' | 'amount' | 'description' | 'date' | 'account_id' | 'credit_card_id'
  >
): string {
  return [
    transaction.account_id || '',
    transaction.credit_card_id || '',
    transaction.type,
    transaction.date,
    moneyKey(transaction.amount),
    normalizeText(transaction.description),
  ].join('|')
}

function assertCivilDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Data inválida na importação: ${value || '(vazia)'}`)
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Data civil inválida na importação: ${value}`)
  }
}

export async function importAccountTransactions(
  input: ImportAccountTransactionsInput
): Promise<ImportAccountTransactionsResult> {
  const { userId, context, accountId, source } = input

  if (!userId || !accountId) {
    throw new Error('Usuário e conta são obrigatórios para importar.')
  }

  if (input.transactions.length === 0) {
    throw new Error('Nenhuma transação válida para importar.')
  }

  return db.transaction(
    'rw',
    db.accounts,
    db.transactions,
    db.syncQueue,
    async () => {
      const account = await db.accounts.get(accountId)

      if (
        !account ||
        account.user_id !== userId ||
        account.context !== context ||
        account.is_archived
      ) {
        throw new Error('Conta selecionada não está disponível neste contexto.')
      }

      const existing = await db.transactions
        .where('[user_id+account_id]')
        .equals([userId, accountId])
        .toArray()

      const existingCounts = new Map<string, number>()

      for (const transaction of existing) {
        if (transaction.context !== context) continue

        const signature = buildImportTransactionSignature(transaction)
        existingCounts.set(
          signature,
          (existingCounts.get(signature) || 0) + 1
        )
      }

      const now = new Date().toISOString()
      const accepted: LocalTransaction[] = []
      let duplicates = 0

      for (const item of input.transactions) {
        const amount = Math.abs(Number(item.amount))
        const description = String(item.description || '').trim()

        if (
          (item.type !== 'income' && item.type !== 'expense') ||
          !Number.isFinite(amount) ||
          amount <= 0 ||
          !description
        ) {
          throw new Error('Há uma transação inválida no lote de importação.')
        }

        assertCivilDate(item.date)

        const transaction: LocalTransaction = {
          id: crypto.randomUUID(),
          user_id: userId,
          context,
          type: item.type,
          amount,
          description,
          date: item.date,
          status: 'done',
          affects_balance: true,
          category_id: item.category_id ?? null,
          account_id: accountId,
          credit_card_id: null,
          invoice_id: null,
          notes: item.notes ?? null,
          receipt_url: item.receipt_url ?? null,
          created_at: now,
          updated_at: now,
          sync_status: 'pending',
          sync_attempts: 0,
        }

        const signature = buildImportTransactionSignature(transaction)
        const previousCount = existingCounts.get(signature) || 0

        if (previousCount > 0) {
          existingCounts.set(signature, previousCount - 1)
          duplicates++
          continue
        }

        accepted.push(transaction)
      }

      let balanceDelta = 0

      for (const transaction of accepted) {
        balanceDelta +=
          transaction.type === 'income'
            ? transaction.amount
            : -transaction.amount

        await db.transactions.add(transaction)

        await addToSyncQueue(
          userId,
          'transactions',
          'create',
          transaction.id,
          transaction
        )
      }

      if (accepted.length > 0) {
        const updatedAccount = {
          ...account,
          balance: Number(account.balance || 0) + balanceDelta,
          updated_at: now,
          sync_status: 'pending' as const,
        }

        await db.accounts.put(updatedAccount)

        await addToSyncQueue(
          userId,
          'accounts',
          'update',
          account.id,
          updatedAccount
        )
      }

      console.info(
        `[import:${source}] ${accepted.length} importadas, ${duplicates} duplicadas ignoradas`
      )

      return {
        imported: accepted.length,
        duplicates,
        balanceDelta,
      }
    }
  )
}
