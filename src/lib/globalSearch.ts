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
    .replace(/\s+/g, ' ')

const numberOrUndefined = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const moneyTokens = (value: unknown) => {
  const n = numberOrUndefined(value)
  if (n === undefined) return []
  return [
    String(n),
    n.toFixed(2),
    n.toFixed(2).replace('.', ','),
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ].map(norm)
}

const MONTHS: Record<string, number> = {
  janeiro: 1, jan: 1, fevereiro: 2, fev: 2, marco: 3, mar: 3,
  abril: 4, abr: 4, maio: 5, mai: 5, junho: 6, jun: 6,
  julho: 7, jul: 7, agosto: 8, ago: 8, setembro: 9, set: 9,
  outubro: 10, out: 10, novembro: 11, nov: 11, dezembro: 12, dez: 12,
}

type DateIntent = { start: string; end: string; consumed: string[] }

function isoLocal(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateIntent(query: string): DateIntent | null {
  const q = norm(query)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  if (/\bhoje\b/.test(q)) {
    const day = isoLocal(today)
    return { start: day, end: day, consumed: ['hoje'] }
  }
  if (/\bontem\b/.test(q)) {
    const d = new Date(today); d.setDate(d.getDate() - 1)
    const day = isoLocal(d)
    return { start: day, end: day, consumed: ['ontem'] }
  }

  for (const [name, month] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b${name}\\b(?:\\s+(?:de\\s+)?(20\\d{2}))?`)
    const match = q.match(re)
    if (!match) continue
    const year = Number(match[1] || today.getFullYear())
    const start = `${year}-${String(month).padStart(2, '0')}-01`
    const last = new Date(year, month, 0).getDate()
    const end = `${year}-${String(month).padStart(2, '0')}-${String(last).padStart(2, '0')}`
    return { start, end, consumed: match[0].split(/\s+/) }
  }
  return null
}

function searchableTokens(query: string, intent: DateIntent | null) {
  const consumed = new Set(intent?.consumed.map(norm) || [])
  return norm(query)
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !consumed.has(token) && token !== 'de')
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
    'transactions', 'accounts', 'credit_cards', 'debts', 'loans',
    'financings', 'subscriptions', 'goals', 'categories',
  ] as const

  const [rows, categories, accounts, contacts] = await Promise.all([
    Promise.all(names.map((name) => (db as any)[name].where('[user_id+context]').equals([userId, context]).toArray())),
    db.categories.where('[user_id+context]').equals([userId, context]).toArray(),
    db.accounts.where('[user_id+context]').equals([userId, context]).toArray(),
    db.contacts.where('[user_id+context]').equals([userId, context]).toArray(),
  ])

  const categoryMap = new Map(categories.map((row: any) => [row.id, row]))
  const accountMap = new Map(accounts.map((row: any) => [row.id, row]))
  const contactMap = new Map(contacts.map((row: any) => [row.id, row]))
  const dateIntent = parseDateIntent(query)
  const tokens = searchableTokens(query, dateIntent)
  const out: Array<GlobalSearchResult & { _score: number }> = []

  const config: Record<string, { kind: string; label: string; base: string }> = {
    transactions: { kind: 'transaction', label: 'Transação', base: '/transactions/details?id=' },
    accounts: { kind: 'account', label: 'Conta', base: '/accounts/details?id=' },
    credit_cards: { kind: 'card', label: 'Cartão', base: '/cards/details?id=' },
    debts: { kind: 'debt', label: 'Quem me deve', base: '/debts/details?id=' },
    loans: { kind: 'loan', label: 'Empréstimo', base: '/loans/details?id=' },
    financings: { kind: 'financing', label: 'Financiamento', base: '/financings/details?id=' },
    subscriptions: { kind: 'subscription', label: 'Recorrência', base: '/subscriptions/details?id=' },
    goals: { kind: 'goal', label: 'Meta', base: '/goals/details?id=' },
    categories: { kind: 'category', label: 'Categoria', base: '/categories' },
  }

  names.forEach((name, index) => {
    rows[index].forEach((row: any) => {
      const category: any = name === 'transactions' && row.category_id ? categoryMap.get(row.category_id) : undefined
      const account: any = name === 'transactions' && row.account_id ? accountMap.get(row.account_id) : undefined
      const contact: any = name === 'transactions' && row.contact_id ? contactMap.get(row.contact_id) : undefined
      const date = row.date || row.due_date || row.updated_at || row.created_at
      if (dateIntent && date && (String(date).slice(0, 10) < dateIntent.start || String(date).slice(0, 10) > dateIntent.end)) return
      if (dateIntent && !date) return

      const fields = [
        row.description, row.name, row.title, row.person_name, row.lender, row.notes,
        category?.name, account?.name, account?.bank, account?.bank_name,
        contact?.name, contact?.person_name,
        row.receipt_url ? 'comprovante anexo recibo' : '',
        ...moneyTokens(row.amount), ...moneyTokens(row.balance),
        ...moneyTokens(row.total_amount), ...moneyTokens(row.remaining_amount),
      ].map(norm).filter(Boolean)
      const haystack = fields.join(' ')
      if (tokens.length && !tokens.every((token) => haystack.includes(token))) return
      if (!tokens.length && !dateIntent) return

      let score = 0
      for (const token of tokens) {
        if (norm(row.description).includes(token) || norm(row.name).includes(token) || norm(row.title).includes(token)) score += 8
        else if (norm(category?.name).includes(token)) score += 6
        else if (norm(account?.name).includes(token) || norm(account?.bank).includes(token) || norm(account?.bank_name).includes(token)) score += 5
        else if (haystack.includes(token)) score += 2
      }
      if (dateIntent) score += 4
      if (row.receipt_url && tokens.some((t) => ['comprovante','anexo','recibo'].includes(t))) score += 5

      const cfg = config[name]
      const title = row.description || row.name || row.title || row.person_name || row.lender || cfg.label
      out.push({
        id: row.id,
        kind: cfg.kind,
        title,
        subtitle: name === 'transactions' && account?.name ? `${cfg.label} • ${account.name}` : cfg.label,
        href: name === 'categories' ? cfg.base : `${cfg.base}${encodeURIComponent(row.id)}`,
        amount: numberOrUndefined(row.amount ?? row.balance ?? row.total_amount ?? row.remaining_amount),
        date,
        transactionType: name === 'transactions' ? row.type : undefined,
        categoryName: category?.name,
        categoryIcon: name === 'categories' ? row.icon : category?.icon,
        categoryColor: name === 'categories' ? row.color : category?.color,
        hasAttachment: name === 'transactions' ? Boolean(row.receipt_url) : false,
        status: row.status,
        _score: score,
      })
    })
  })

  return out
    .sort((a, b) => b._score - a._score || String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, limit)
    .map(({ _score, ...item }) => item)
}
