// src/lib/transactionCategoryOperations.ts

export type TransactionCategoryType =
  | 'income'
  | 'expense'

export type TransactionLikeType =
  | 'income'
  | 'expense'
  | 'sangria'
  | 'transfer'
  | string
  | null
  | undefined

export interface TransactionCategoryLike {
  id?: string | null
  type?: string | null
  context?: string | null
  parent_id?: string | null
  order_index?: number | null
  name?: string | null
}

/**
 * Tipo semântico de categoria aceito por uma movimentação.
 *
 * - income -> categoria de receita
 * - expense/sangria -> categoria de despesa
 * - transfer -> não possui categoria financeira de receita/despesa
 */
export function getTransactionCategoryType(
  transactionType: TransactionLikeType
): TransactionCategoryType | null {
  if (transactionType === 'income') {
    return 'income'
  }

  if (
    transactionType === 'expense' ||
    transactionType === 'sangria'
  ) {
    return 'expense'
  }

  return null
}

export function isCategoryCompatibleWithTransactionType(
  category: TransactionCategoryLike | null | undefined,
  transactionType: TransactionLikeType
) {
  if (!category) return false

  const expected =
    getTransactionCategoryType(
      transactionType
    )

  if (!expected) return false

  return category.type === expected
}

export function filterTransactionCategories<
  T extends TransactionCategoryLike
>(
  categories: T[] | null | undefined,
  transactionType: TransactionLikeType,
  context?: string | null
): T[] {
  const expected =
    getTransactionCategoryType(
      transactionType
    )

  if (!expected) return []

  return (categories || [])
    .filter((category) => {
      if (
        category.type !== expected
      ) {
        return false
      }

      if (
        context &&
        category.context &&
        category.context !== context
      ) {
        return false
      }

      return true
    })
    .sort((a, b) => {
      const orderA =
        a.order_index ?? 9999

      const orderB =
        b.order_index ?? 9999

      if (orderA !== orderB) {
        return orderA - orderB
      }

      return String(a.name || '')
        .localeCompare(
          String(b.name || ''),
          'pt-BR'
        )
    })
}

export function findCompatibleCategory<
  T extends TransactionCategoryLike
>(
  categories: T[] | null | undefined,
  categoryId: string | null | undefined,
  transactionType: TransactionLikeType,
  context?: string | null
): T | null {
  if (!categoryId) return null

  return (
    filterTransactionCategories(
      categories,
      transactionType,
      context
    ).find(
      (category) =>
        category.id === categoryId
    ) || null
  )
}
