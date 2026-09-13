// src/lib/transactionSeriesOperations.ts

import {
  addToSyncQueue,
  db,
  type LocalTransaction,
} from '@/lib/db'
import {
  reconcileCardInvoiceCycle,
} from '@/lib/cardOperations'

export type TransactionSeriesScope =
  | 'single'
  | 'future'
  | 'all'

export type TransactionSeriesKind =
  | 'single'
  | 'installments'
  | 'recurring'

export function getTransactionSeriesKind(
  tx?: Partial<LocalTransaction> | null
): TransactionSeriesKind {
  if (!tx?.recurring_group_id) {
    return 'single'
  }

  /*
   * Contrato canônico daqui para frente:
   *
   * parcelamento:
   *   recurring_group_id + total_installments > 1
   *
   * recorrência:
   *   recurring_group_id + total_installments ausente/null
   *
   * Séries legadas podem ainda carregar total_installments mesmo
   * quando nasceram pela opção "Recorrente". Não tentamos adivinhar
   * nem reescrever histórico automaticamente.
   */
  if (
    Number(
      tx.total_installments || 0
    ) > 1
  ) {
    return 'installments'
  }

  return 'recurring'
}

export function hasTransactionSeries(
  tx?: Partial<LocalTransaction> | null
) {
  return Boolean(
    tx?.recurring_group_id
  )
}

export async function getTransactionSeriesMembers(
  userId: string,
  source: LocalTransaction
) {
  if (
    !userId ||
    !source.recurring_group_id
  ) {
    return [source]
  }

  const items =
    await db.transactions
      .where('user_id')
      .equals(userId)
      .filter(
        (item) =>
          item.recurring_group_id ===
          source.recurring_group_id
      )
      .toArray()

  return items.sort(
    (a, b) => {
      const byDate =
        String(a.date || '')
          .localeCompare(
            String(b.date || '')
          )

      if (byDate !== 0) {
        return byDate
      }

      return (
        Number(
          a.installment_index || 0
        ) -
        Number(
          b.installment_index || 0
        )
      )
    }
  )
}

export function selectTransactionSeriesMembers(
  members: LocalTransaction[],
  source: LocalTransaction,
  scope: TransactionSeriesScope
) {
  if (scope === 'single') {
    return members.filter(
      (item) =>
        item.id === source.id
    )
  }

  if (scope === 'future') {
    return members.filter(
      (item) =>
        item.id === source.id ||
        String(item.date || '') >=
          String(source.date || '')
    )
  }

  return members
}

type PlanningPatch = Pick<
  LocalTransaction,
  | 'type'
  | 'amount'
  | 'description'
  | 'category_id'
  | 'account_id'
  | 'credit_card_id'
  | 'contact_id'
  | 'tag_ids'
  | 'notes'
  | 'financing_id'
  | 'loan_id'
>

export async function propagatePendingTransactionSeriesUpdate({
  userId,
  source,
  scope,
  patch,
}: {
  userId: string
  source: LocalTransaction
  scope: Exclude<
    TransactionSeriesScope,
    'single'
  >
  patch: Partial<PlanningPatch>
}) {
  if (
    !source.recurring_group_id
  ) {
    return {
      updated: 0,
      preservedRealized: 0,
    }
  }

  const members =
    await getTransactionSeriesMembers(
      userId,
      source
    )

  const selected =
    selectTransactionSeriesMembers(
      members,
      source,
      scope
    ).filter(
      (item) =>
        item.id !== source.id
    )

  /*
   * Histórico realizado é imutável por propagação de série.
   * A própria ocorrência aberta pelo usuário pode ser editada
   * pela tela normal, que já sabe reverter/reaplicar o saldo.
   *
   * Irmãs realizadas não são reescritas silenciosamente.
   */
  const editable =
    selected.filter(
      (item) =>
        item.status === 'pending' &&
        item.affects_balance === false
    )

  const preservedRealized =
    selected.length -
    editable.length

  if (editable.length === 0) {
    return {
      updated: 0,
      preservedRealized,
    }
  }

  const now =
    new Date().toISOString()

  const affectedCards =
    new Map<
      string,
      {
        cardId: string
        date: string
      }
    >()

  await db.transaction(
    'rw',
    [
      db.transactions,
      db.credit_cards,
      db.credit_invoices,
      db.syncQueue,
    ],
    async () => {
      for (const member of editable) {
        if (
          member.credit_card_id &&
          member.date
        ) {
          affectedCards.set(
            `${member.credit_card_id}:${member.date}`,
            {
              cardId:
                member.credit_card_id,
              date: member.date,
            }
          )
        }

        const next: LocalTransaction = {
          ...member,
          ...patch,

          /*
           * Identidade da ocorrência nunca é propagada.
           */
          id: member.id,
          user_id: member.user_id,
          date: member.date,
          created_at:
            member.created_at,
          recurring_group_id:
            member.recurring_group_id,
          installment_index:
            member.installment_index,
          total_installments:
            member.total_installments,

          /*
           * Ocorrência futura/pendente permanece sem efeito no saldo.
           */
          status: 'pending',
          affects_balance: false,

          updated_at: now,
          sync_status: 'pending',
        }

        await db.transactions.put(
          next
        )

        await addToSyncQueue(
          userId,
          'transactions',
          'update',
          member.id,
          next
        )

        if (
          next.credit_card_id &&
          next.date
        ) {
          affectedCards.set(
            `${next.credit_card_id}:${next.date}`,
            {
              cardId:
                next.credit_card_id,
              date: next.date,
            }
          )
        }
      }

      for (
        const reference of
        Array.from(
          affectedCards.values()
        )
      ) {
        const card =
          await db.credit_cards.get(
            reference.cardId
          )

        if (!card) {
          continue
        }

        if (
          card.user_id !== userId
        ) {
          throw new Error(
            'Cartão de uma ocorrência da série pertence a outro usuário.'
          )
        }

        await reconcileCardInvoiceCycle({
          userId,
          card,
          transactionDate:
            reference.date,
        })
      }
    }
  )

  return {
    updated: editable.length,
    preservedRealized,
  }
}
