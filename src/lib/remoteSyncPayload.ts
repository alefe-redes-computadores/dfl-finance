import type { LocalSyncQueue } from '@/lib/db'
import { financialOperationId, transactionCashEffect } from '@/lib/financialSyncContract'

const LOCAL_ONLY_REMOTE_KEYS =
  new Set([
    'syncstatus',
    'syncattempts',
    'lastsyncerror',
    'syncbase',
    'syncremoteversion',
  ])

const TRANSACTION_PRESENTATION_REMOTE_KEYS =
  new Set([
    'categoryname',
    'accountname',
  ])

export function sanitizeRemotePayload(
  source: Record<string, any>,
  recordId: string,
  userId: string,
  table?: LocalSyncQueue['table']
) {
  const sanitizedEntries =
    Object.entries(source)
      .filter(([key, value]) => {
        if (value === undefined) {
          return false
        }

        const normalizedKey =
          key
            .replace(
              /[^a-zA-Z0-9]/g,
              ''
            )
            .toLowerCase()

        return (
          !LOCAL_ONLY_REMOTE_KEYS.has(
            normalizedKey
          ) &&
          !(
            table ===
              'transactions' &&
            TRANSACTION_PRESENTATION_REMOTE_KEYS.has(
              normalizedKey
            )
          )
        )
      })
      .map(([key, value]) => {
        const normalizedKey =
          key
            .replace(
              /[^a-zA-Z0-9]/g,
              ''
            )
            .toLowerCase()

        const legacyRemoteKeyAliases: Record<string, string> = {
          userid: 'user_id',
          accountid: 'account_id',
          categoryid: 'category_id',
          creditcardid: 'credit_card_id',
          invoiceid: 'invoice_id',
          debtid: 'debt_id',
          goalid: 'goal_id',
          contactid: 'contact_id',
          linkedtransactionid: 'linked_transaction_id',
          recurringgroupid: 'recurring_group_id',

          /*
           * Compatibilidade com transferências criadas por
           * versões antigas do app.
           *
           * O backend atual expõe to_account_id. As chaves
           * transfer_to/transfer_from nunca existiram como
           * colunas remotas e poderiam deixar itens antigos
           * presos na fila.
           */
          transferto: 'to_account_id',
          transferfrom: 'to_account_id',
          transfergroupid: 'transfer_group_id',
          idempotencykey: 'idempotency_key',

          affectsbalance: 'affects_balance',
          createdat: 'created_at',
          updatedat: 'updated_at',
        }

        const canonicalKey =
          legacyRemoteKeyAliases[normalizedKey]

        if (canonicalKey) {
          return [
            canonicalKey,
            value,
          ]
        }

        if (
          table ===
            'chat_history' &&
          key === 'role' &&
          value === 'assistant'
        ) {
          return [
            'role',
            'model',
          ]
        }

        return [
          key,
          value,
        ]
      })

  const result = Object.fromEntries([
    ...sanitizedEntries,
    ['id', recordId],
    ['user_id', userId],
  ])
  if (table === 'transactions' && result.idempotency_key) {
    const key = String(result.idempotency_key)
    if (result.type === 'transfer' && !result.transfer_direction) {
      if (key.endsWith(':out')) result.transfer_direction = 'out'
      if (key.endsWith(':in')) result.transfer_direction = 'in'
    }
    result.idempotency_key = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(key) ? key : financialOperationId(`${userId}:${key}`)
  }
  if (table === 'transactions') {
    const effect = transactionCashEffect(result)
    if (effect !== null) result.cash_delta = effect
  }
  if (table === 'loans' && result.amount != null) result.total_amount = result.amount
  if (table === 'financings') {
    if (result.installments_count != null) result.total_installments = result.installments_count
    if (result.installment_amount != null) result.installment_value = result.installment_amount
    if (result.remaining_amount != null) result.outstanding_balance = result.remaining_amount
    if (result.description) result.name = result.description
  }
  return result
}
