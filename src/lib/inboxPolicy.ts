import { civilDate, civilISO } from '@/lib/financialForecast'

const REVIEW_SOURCES = new Set(['whatsapp', 'ai_ocr', 'ofx_import', 'ofx_merged', 'csv_import', 'csv'])
export function needsFinancialReview(row: any): boolean {
  return !row?.reviewed_at && REVIEW_SOURCES.has(String(row?.source || ''))
}
export function pendingDueDate(row: any): string | null {
  return civilDate(row?.due_date || row?.date)
}
/** The Inbox settles ordinary cash only. Cards/contracts keep their owner flow. */
export function isInboxCandidate(row: any): boolean {
  return row?.status === 'pending' && ['income', 'expense', 'sangria'].includes(row.type) &&
    !row.transfer_group_id && !row.credit_card_id && !row.invoice_id && !row.loan_id &&
    !row.financing_id && !row.debt_id && !row.goal_id
}
export function belongsInFinancialInbox(row: any, today = civilISO(new Date())): boolean {
  if (!isInboxCandidate(row)) return false
  const due = pendingDueDate(row)
  return needsFinancialReview(row) || !due || due <= today
}
export function inboxState(row: any, today = civilISO(new Date())) {
  const due = pendingDueDate(row)
  return { review: needsFinancialReview(row) || !due, overdue: Boolean(due && due < today),
    today: due === today, future: Boolean(due && due > today), due }
}
