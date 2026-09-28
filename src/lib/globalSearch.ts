import { db } from '@/lib/db'

export type GlobalSearchResult = {
  id: string
  kind: string
  title: string
  subtitle: string
  href: string
  amount?: number
  date?: string
  transactionType?: string
  categoryName?: string
  categoryIcon?: string
  categoryColor?: string
  hasAttachment?: boolean
  status?: string
}

const norm = (v: unknown) =>
  String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const numberOrUndefined = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export async function searchFinancialData(
  userId: string,
  context: 'dfl' | 'personal',
  query: string,
  limit = 40
): Promise<GlobalSearchResult[]> {
  const term = norm(query)
  if (term.length < 2) return []

  const names = [
    'transactions',
    'accounts',
    'credit_cards',
    'debts',
    'loans',
    'financings',
    'subscriptions',
    'goals',
    'categories',
  ] as const

  const [rows, categories] = await Promise.all([
    Promise.all(
      names.map((name) =>
        (db as any)[name]
          .where('[user_id+context]')
          .equals([userId, context])
          .toArray()
      )
    ),
    db.categories
      .where('[user_id+context]')
      .equals([userId, context])
      .toArray(),
  ])

  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const out: GlobalSearchResult[] = []

  const config: Record<
    string,
    { kind: string; label: string; base: string }
  > = {
    transactions: {
      kind: 'transaction',
      label: 'Transação',
      base: '/transactions/details?id=',
    },
    accounts: {
      kind: 'account',
      label: 'Conta',
      base: '/accounts/details?id=',
    },
    credit_cards: {
      kind: 'card',
      label: 'Cartão',
      base: '/cards/details?id=',
    },
    debts: {
      kind: 'debt',
      label: 'Quem me deve',
      base: '/debts/details?id=',
    },
    loans: {
      kind: 'loan',
      label: 'Empréstimo',
      base: '/loans/details?id=',
    },
    financings: {
      kind: 'financing',
      label: 'Financiamento',
      base: '/financings/details?id=',
    },
    subscriptions: {
      kind: 'subscription',
      label: 'Recorrência',
      base: '/subscriptions/details?id=',
    },
    goals: {
      kind: 'goal',
      label: 'Meta',
      base: '/goals/details?id=',
    },
    categories: {
      kind: 'category',
      label: 'Categoria',
      base: '/categories',
    },
  }

  names.forEach((name, index) => {
    rows[index].forEach((row: any) => {
      const category =
        name === 'transactions' && row.category_id
          ? categoryMap.get(row.category_id)
          : undefined

      const haystack = [
        row.description,
        row.name,
        row.title,
        row.person_name,
        row.lender,
        row.notes,
        row.amount,
        row.balance,
        category?.name,
      ]
        .map(norm)
        .join(' ')

      if (!haystack.includes(term)) return

      const cfg = config[name]
      const title =
        row.description ||
        row.name ||
        row.title ||
        row.person_name ||
        row.lender ||
        cfg.label

      const href =
        name === 'categories'
          ? cfg.base
          : `${cfg.base}${encodeURIComponent(row.id)}`

      out.push({
        id: row.id,
        kind: cfg.kind,
        title,
        subtitle: cfg.label,
        href,
        amount: numberOrUndefined(
          row.amount ??
            row.balance ??
            row.total_amount ??
            row.remaining_amount
        ),
        date: row.date || row.due_date || row.updated_at || row.created_at,
        transactionType: name === 'transactions' ? row.type : undefined,
        categoryName: category?.name,
        categoryIcon:
          name === 'categories' ? row.icon : category?.icon,
        categoryColor:
          name === 'categories' ? row.color : category?.color,
        hasAttachment:
          name === 'transactions' ? Boolean(row.receipt_url) : false,
        status: row.status,
      })
    })
  })

  return out
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, limit)
}
