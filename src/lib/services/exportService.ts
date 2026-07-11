import { supabase } from '@/lib/supabase'

interface Transaction {
  date: string
  description: string | null
  type: 'income' | 'expense' | 'transfer' | 'sangria'
  amount: number
  status: 'done' | 'pending'
  categories?: { name: string }
  accounts?: { name: string }
}

export async function exportTransactionsToCSV(
  userId: string,
  context: 'dfl' | 'personal',
  range: string = '30'
): Promise<Blob> {
  const startDate = new Date()
  
  if (range === 'total') {
    startDate.setFullYear(startDate.getFullYear() - 10)
  } else {
    startDate.setDate(startDate.getDate() - parseInt(range))
  }

  const start = startDate.toISOString().split('T')[0]
  const end = new Date().toISOString().split('T')[0]

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('date, description, type, amount, status, categories(name), accounts(name)')
    .eq('user_id', userId)
    .eq('context', context)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })

  if (error) throw error

  const header = 'Data,Descrição,Categoria,Conta,Tipo,Valor,Status\n'

  if (!transactions || transactions.length === 0) {
    return new Blob([header], { type: 'text/csv;charset=utf-8;' })
  }

  const rows = (transactions as Transaction[]).map(t => {
    const date = t.date || ''
    const desc = `"${(t.description || '').replace(/"/g, '""')}"`
    const cat = `"${((t.categories as any)?.name || 'Geral').replace(/"/g, '""')}"`
    const acc = `"${((t.accounts as any)?.name || '').replace(/"/g, '""')}"`
    const type = t.type === 'income' ? 'Receita' : t.type === 'transfer' ? 'Transferência' : 'Despesa'
    const amount = (Number(t.amount) || 0).toFixed(2).replace('.', ',')
    const status = t.status === 'done' ? 'Efetivada' : 'Pendente'
    
    return `${date},${desc},${cat},${acc},${type},${amount},${status}`
  }).join('\n')

  const income = (transactions as Transaction[])
    .filter(t => t.type === 'income' && t.status === 'done')
    .reduce((a, t) => a + (Number(t.amount) || 0), 0)
  
  const expense = (transactions as Transaction[])
    .filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
    .reduce((a, t) => a + (Number(t.amount) || 0), 0)
  
  const balance = income - expense

  const totals = `\n\n"TOTAL RECEITAS",,,,,"${income.toFixed(2).replace('.', ',')}"`
    + `\n"TOTAL DESPESAS",,,,,"${expense.toFixed(2).replace('.', ',')}"`
    + `\n"SALDO",,,,,"${balance.toFixed(2).replace('.', ',')}"`

  const csv = header + rows + totals

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
}

export async function downloadCSV(blob: Blob, filename: string) {
  try {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    // Essencial para funcionar no Capacitor
    document.body.appendChild(link)
    
    // Dispara o download
    link.click()

    // Atraso de 1 segundo (1000ms) para dar tempo ao Android de processar o download
    setTimeout(() => {
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    }, 1000)
    
  } catch (error) {
    console.error('Erro ao baixar arquivo:', error)
    throw new Error('Falha ao tentar salvar o arquivo no dispositivo.')
  }
}
export async function exportAnalysisToCSV(
  userId: string,
  context: 'dfl' | 'personal',
  month: Date
): Promise<Blob> {
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1)
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0)

  const start = startDate.toISOString().split('T')[0]
  const end = endDate.toISOString().split('T')[0]

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('date, description, type, amount, status, categories(name, color)')
    .eq('user_id', userId)
    .eq('context', context)
    .gte('date', start)
    .lte('date', end)

  if (error) throw error

  const txs = transactions as Transaction[]
  const income = txs.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
  const expense = txs.filter(t => t.type === 'expense' || t.type === 'sangria').reduce((a, t) => a + Number(t.amount), 0)
  const balance = income - expense

  const catMap: Record<string, any> = {}
  txs.filter(t => t.type === 'expense' || t.type === 'sangria').forEach(t => {
    const key = (t.categories as any)?.name || 'Sem categoria'
    if (!catMap[key]) catMap[key] = 0
    catMap[key] += Number(t.amount)
  })

  const header = 'ANÁLISE - ' + startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase() + '\n\n'
  const summary = `RECEITAS,${income.toFixed(2).replace('.', ',')}\nDESPESAS,${expense.toFixed(2).replace('.', ',')}\nBALANÇO,${balance.toFixed(2).replace('.', ',')}\n\n`
  const categoryHeader = 'DESPESAS POR CATEGORIA\n'
  const categoryRows = Object.entries(catMap)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([cat, amount]) => `${cat},${(amount as number).toFixed(2).replace('.', ',')}`)
    .join('\n')

  const csv = header + summary + categoryHeader + categoryRows

  return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
}