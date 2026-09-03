// src/lib/services/exportService.ts
import { db } from '@/lib/db'

interface Transaction {
  date: string
  description: string | null
  type: 'income' | 'expense' | 'transfer' | 'sangria'
  amount: number
  status: 'done' | 'pending'
  category_id?: string | null
  account_id?: string | null
}

const csvText = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
const money = (value: number) => value.toFixed(2).replace('.', ',')

function localISO(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function loadLocalData(userId: string, context: 'dfl' | 'personal') {
  const [transactions, categories, accounts] = await Promise.all([
    db.transactions.where('user_id').equals(userId).toArray(),
    db.categories.where('user_id').equals(userId).toArray(),
    db.accounts.where('user_id').equals(userId).toArray(),
  ])

  return {
    transactions: transactions.filter((t: any) => t.context === context) as Transaction[],
    categories: new Map(categories.map((c: any) => [c.id, c])),
    accounts: new Map(accounts.map((a: any) => [a.id, a])),
  }
}

export async function exportTransactionsToCSV(
  userId: string,
  context: 'dfl' | 'personal',
  range: string = '30'
): Promise<{ csv: string; filename: string }> {
  const { transactions, categories, accounts } = await loadLocalData(userId, context)
  const today = new Date()
  const end = localISO(today)
  const startDate = new Date(today)

  if (range === 'total') startDate.setFullYear(startDate.getFullYear() - 100)
  else {
    const days = Number.parseInt(range, 10)
    startDate.setDate(startDate.getDate() - (Number.isFinite(days) ? days : 30))
  }

  const start = localISO(startDate)
  const filtered = transactions
    .filter(t => t.date >= start && t.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date))

  const header = 'Data,Descrição,Categoria,Conta,Tipo,Valor,Status\n'
  const rows = filtered.map(t => {
    const category: any = categories.get(t.category_id)
    const account: any = accounts.get(t.account_id)
    const type = t.type === 'income' ? 'Receita' : t.type === 'transfer' ? 'Transferência' : t.type === 'sangria' ? 'Sangria' : 'Despesa'
    const status = t.status === 'done' ? 'Efetivada' : 'Pendente'
    return [
      csvText(t.date),
      csvText(t.description || ''),
      csvText(category?.name || 'Geral'),
      csvText(account?.name || ''),
      csvText(type),
      csvText(money(Number(t.amount) || 0)),
      csvText(status),
    ].join(',')
  }).join('\n')

  const done = filtered.filter(t => t.status === 'done')
  const income = done.filter(t => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const expense = done.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const balance = income - expense
  const totals = `\n\n"TOTAL RECEITAS",,,,,"${money(income)}"` +
    `\n"TOTAL DESPESAS",,,,,"${money(expense)}"` +
    `\n"SALDO",,,,,"${money(balance)}"`

  return { csv: header + rows + totals, filename: `extrato-${context}-${end}.csv` }
}

export async function exportAnalysisToCSV(
  userId: string,
  context: 'dfl' | 'personal',
  month: Date
): Promise<{ csv: string; filename: string }> {
  const { transactions, categories } = await loadLocalData(userId, context)
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1)
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const start = localISO(startDate)
  const end = localISO(endDate)

  const txs = transactions.filter(t => t.date >= start && t.date <= end && t.status === 'done')
  const income = txs.filter(t => t.type === 'income').reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const expenseTxs = txs.filter(t => t.type === 'expense' || t.type === 'sangria')
  const expense = expenseTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  const balance = income - expense

  const catMap = new Map<string, number>()
  expenseTxs.forEach(t => {
    const category: any = categories.get(t.category_id)
    const name = category?.name || 'Sem categoria'
    catMap.set(name, (catMap.get(name) || 0) + (Number(t.amount) || 0))
  })

  const monthName = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()
  const header = `ANÁLISE - ${monthName}\n\n`
  const summary = `RECEITAS,${csvText(money(income))}\nDESPESAS,${csvText(money(expense))}\nBALANÇO,${csvText(money(balance))}\n\n`
  const categoryHeader = 'DESPESAS POR CATEGORIA\n'
  const categoryRows = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => `${csvText(category)},${money(amount)}\n`)
    .join('')

  return {
    csv: header + summary + categoryHeader + categoryRows,
    filename: `analise-${context}-${start}.csv`,
  }
}

export function downloadCSV(csv: string, filename: string) {
  if (typeof window === 'undefined') return

  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = window.URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)

    setTimeout(() => {
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }, 300)
  } catch (error) {
    console.error('Erro ao fazer download:', error)
    throw new Error('Erro ao fazer download do arquivo')
  }
}
