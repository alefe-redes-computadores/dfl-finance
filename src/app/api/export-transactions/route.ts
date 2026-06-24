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

  const { data: transactions } = await supabase
    .from('transactions')
    .select('date, description, type, amount, status, categories!inner(name), accounts!inner(name)')
    .eq('user_id', userId)
    .eq('context', context)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })

  if (!transactions) {
    return NextResponse.json({ error: 'Nenhuma transação encontrada' }, { status: 404 })
  }

  const header = 'Data,Descrição,Categoria,Conta,Tipo,Valor,Status\n'
  const rows = transactions.map(t => {
    const date = t.date || ''
    const desc = `"${(t.description || '').replace(/"/g, '""')}"`
    const cat = `"${((t.categories as any)?.name || 'Geral').replace(/"/g, '""')}"`
    const acc = `"${((t.accounts as any)?.name || '').replace(/"/g, '""')}"`
    const type = t.type === 'income' ? 'Receita' : t.type === 'transfer' ? 'Transferência' : 'Despesa'
    const amount = (Number(t.amount) || 0).toFixed(2).replace('.', ',')
    const status = t.status === 'done' ? 'Efetivada' : 'Pendente'
    return `${date},${desc},${cat},${acc},${type},${amount},${status}`
  }).join('\n')

  const income = transactions.filter(t => t.type === 'income' && t.status === 'done')
    .reduce((a, t) => a + (Number(t.amount) || 0), 0)
  const expense = transactions.filter(t => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
    .reduce((a, t) => a + (Number(t.amount) || 0), 0)
  const balance = income - expense

  const totals = `\n\n"TOTAL RECEITAS",,,,,"${income.toFixed(2).replace('.', ',')}"`
  + `\n"TOTAL DESPESAS",,,,,"${expense.toFixed(2).replace('.', ',')}"`
  + `\n"SALDO",,,,,"${balance.toFixed(2).replace('.', ',')}"`

  const csv = header + rows + totals

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename=extrato-${start}-a-${end}.csv`
    }
  })
}