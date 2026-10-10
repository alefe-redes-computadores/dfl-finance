import { db } from '@/lib/db'
import { civilISO } from '@/lib/financialForecast'
/** A future date cannot prove that a recorded payment was accidental. Read only. */
export async function inspectFutureScheduledTransactions(userId: string, today = civilISO(new Date())) {
  if (!userId) return []
  return db.transactions.where('user_id').equals(userId).filter(row => Boolean(row.recurring_group_id) &&
    row.date > today && row.status === 'done' && row.affects_balance !== false &&
    Boolean(row.account_id) && !row.credit_card_id && !row.transfer_group_id &&
    ['income','expense','sangria'].includes(row.type)).toArray()
}
/** Compatibility for old page effects: inspection never reverses an actual payment. */
export async function repairFutureScheduledTransactions(userId: string) {
  const candidates = await inspectFutureScheduledTransactions(userId)
  return { repairedTransactions: 0, repairedAccounts: 0, restoredNetAmount: 0, requiresReview: candidates.length }
}
