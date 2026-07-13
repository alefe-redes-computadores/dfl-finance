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
    .select('amount, type, status, date, description, credit_card_id, categories(name, icon, color)')
    .eq('user_id', userId)
    .eq('context', context)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })

  const txs = Array.isArray(transactions) ? transactions : []

  const income = txs
    .filter((t: any) => t.type === 'income' && t.status === 'done')
    .reduce((a: number, t: any) => a + (Number(t.amount) || 0), 0)
  const expense = txs
    .filter((t: any) => (t.type === 'expense' || t.type === 'sangria') && t.status === 'done')
    .reduce((a: number, t: any) => a + (Number(t.amount) || 0), 0)

  const catMap: Record<string, { total: number; count: number; color: string }> = {}
  txs
    .filter((t: any) => t.type === 'expense' || t.type === 'sangria')
    .forEach((t: any) => {
      const name = t.categories?.name || 'Sem categoria'
      if (!catMap[name]) catMap[name] = { total: 0, count: 0, color: t.categories?.color || '#64748b' }
      catMap[name].total += Number(t.amount) || 0
      catMap[name].count += 1
    })

  const sortedCategories = Object.entries(catMap).sort((a, b) => b[1].total - a[1].total)

  // Montar tabela HTML estilizada
  const categoryRows = sortedCategories.map(([name, data]) => {
    const percent = expense > 0 ? ((data.total / expense) * 100).toFixed(1) : '0'
    return `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${data.color};margin-right:8px;"></span>
          ${name}
        </td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">
          R$ ${data.total.toFixed(2).replace('.', ',')}
        </td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${percent}%</td>
        <td style="padding:10px;border-bottom:1px solid #e5e7eb;text-align:right;">${data.count}</td>
      </tr>`
  }).join('')

  const transactionRows = txs.map((tx: any) => {
    const isIncome = tx.type === 'income'
    const catName = tx.categories?.name || 'Geral'
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${tx.date}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;">${tx.description || catName}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;color:${isIncome ? '#10b981' : '#ef4444'}">
          ${isIncome ? '+' : '-'} R$ ${Number(tx.amount || 0).toFixed(2).replace('.', ',')}
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">
          <span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;background:${tx.status === 'done' ? '#d1fae5' : '#fee2e2'};color:${tx.status === 'done' ? '#059669' : '#dc2626'};">
            ${tx.status === 'done' ? 'Pago' : 'Pendente'}
          </span>
        </td>
      </tr>`
  }).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>DFL Finance - Relatório</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; color: #1e293b; }
    .header { background: linear-gradient(135deg, #0f766e, #f97316); color: white; padding: 24px; border-radius: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 4px 0 0; opacity: 0.9; font-size: 14px; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; }
    .summary-card { flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; text-align: center; }
    .summary-card p { margin: 0; font-size: 12px; color: #64748b; }
    .summary-card h3 { margin: 4px 0 0; font-size: 18px; }
    .section-title { font-size: 16px; font-weight: bold; margin-bottom: 12px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; }
    th { background: #f8fafc; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>DFL Finance</h1>
    <p>Relatório de ${context === 'dfl' ? 'Empresa (DFL)' : 'Pessoal'} • ${start} até ${end}</p>
  </div>

  <div class="summary">
    <div class="summary-card">
      <p>Receitas</p>
      <h3 style="color:#10b981;">R$ ${income.toFixed(2).replace('.', ',')}</h3>
    </div>
    <div class="summary-card">
      <p>Despesas</p>
      <h3 style="color:#ef4444;">R$ ${expense.toFixed(2).replace('.', ',')}</h3>
    </div>
    <div class="summary-card">
      <p>Saldo</p>
      <h3 style="color:${income - expense >= 0 ? '#10b981' : '#ef4444'};">R$ ${(income - expense).toFixed(2).replace('.', ',')}</h3>
    </div>
  </div>

  <div class="section-title">Gastos por Categoria</div>
  <table>
    <thead>
      <tr>
        <th>Categoria</th>
        <th style="text-align:right;">Total</th>
        <th style="text-align:right;">%</th>
        <th style="text-align:right;">Qtd</th>
      </tr>
    </thead>
    <tbody>
      ${categoryRows || '<tr><td colspan="4" style="text-align:center;padding:16px;color:#94a3b8;">Nenhum gasto no período</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">Transações</div>
  <table>
    <thead>
      <tr>
        <th>Data</th>
        <th>Descrição</th>
        <th style="text-align:right;">Valor</th>
        <th style="text-align:center;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${transactionRows || '<tr><td colspan="4" style="text-align:center;padding:16px;color:#94a3b8;">Nenhuma transação no período</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    DFL Finance • Relatório gerado em ${new Date().toLocaleString('pt-BR')}
  </div>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename=relatorio-dfl-${context}-${start}-a-${end}.html`
    }
  })
}
