import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const context = searchParams.get('context') || 'dfl'
  const range = searchParams.get('range') || '30'

  if (!userId) {
    return NextResponse.json({ error: 'Usuário não autenticado' }, { status: 401 })
  }

  const startDate = new Date()
  if (range === 'total') {
    startDate.setFullYear(startDate.getFullYear() - 10)
  } else {
    startDate.setDate(startDate.getDate() - parseInt(range))
  }

  const start = startDate.toISOString().split('T')[0]
  const end = new Date().toISOString().split('T')[0]

  // Busca transações com categorias
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, type, status, categories(name, color)')
    .eq('user_id', userId)
    .eq('context', context)
    .gte('date', start)
    .lte('date', end)

  if (!transactions) {
    return NextResponse.json({ error: 'Nenhuma transação encontrada' }, { status: 404 })
  }

  // Agrupa por categoria
  const catMap: Record<string, { total: number; count: number }> = {}
  let totalExpense = 0

  transactions.filter(t => t.type === 'expense' || t.type === 'sangria').forEach(t => {
    const key = t.categories?.name || 'Sem categoria'
    if (!catMap[key]) catMap[key] = { total: 0, count: 0 }
    catMap[key].total += Number(t.amount) || 0
    catMap[key].count += 1
    totalExpense += Number(t.amount) || 0
  })

  const income = transactions.filter(t => t.type === 'income' && t.status === 'done')
    .reduce((a, t) => a + (Number(t.amount) || 0), 0)
  const expense = transactions.filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
    .reduce((a, t) => a + (Number(t.amount) || 0), 0)

  // Monta CSV
  const header = 'Categoria,Total Gasto,Porcentagem,Quantidade\n'
  const rows = Object.entries(catMap)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, data]) => {
      const percent = totalExpense > 0 ? ((data.total / totalExpense) * 100).toFixed(1) : '0'
      return `"${name}",${data.total.toFixed(2).replace('.', ',')},${percent}%,${data.count}`
    }).join('\n')

  const totals = `\n\n"TOTAL RECEITAS",,,,"${income.toFixed(2).replace('.', ',')}"`
    + `\n"TOTAL DESPESAS",,,,"${expense.toFixed(2).replace('.', ',')}"`
    + `\n"TOTAL GERAL",,,,"${totalExpense.toFixed(2).replace('.', ',')}"`

  const csv = header + rows + totals

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=analise-${start}-a-${end}.csv`
    }
  })
}
