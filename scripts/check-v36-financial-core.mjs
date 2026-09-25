import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V36: ${message}`)
}

const projection = read('src/hooks/useProjection.ts')
const chart = read('src/components/ProjectionChart.tsx')
const home = read('src/app/(app)/home/page.tsx')
const categories = read('src/app/(app)/categories/page.tsx')
const accounts = read('src/app/(app)/accounts/page.tsx')
const categoryOps = read('src/lib/transactionCategoryOperations.ts')

ok(projection.includes('expenseByDay'), 'agregação diária robusta ausente')
ok(projection.includes('positiveDailySamples'), 'amostra positiva ausente')
ok(projection.includes('dailyCap'), 'P90/cap robusto ausente')
ok(projection.includes('robustHistoricalExpense'), 'estimativa robusta ausente')
ok(projection.includes('cappedDays'), 'transparência de outliers ausente')
ok(projection.includes('Gastos excepcionalmente altos foram suavizados'), 'explicação da projeção ausente')
ok(chart.includes('projection.sampleSize'), 'gráfico não mostra tamanho da amostra')
ok(chart.includes('projection.confidence'), 'gráfico não mostra confiança')
ok(chart.includes('projection.cappedDays'), 'gráfico não mostra suavização')
ok(home.includes('pendingDate > todayIso'), 'Home voltou a misturar pendência futura')
ok(home.includes('.sort((a: any, b: any) => safeNumber(b.balance) - safeNumber(a.balance))'), 'Home não preserva contas por saldo')
ok(accounts.includes("'manual' | 'balance' | 'institution' | 'name'"), 'ordenação manual de contas regrediu')
ok(accounts.includes('dfl_accounts_manual_order_'), 'persistência da ordem manual regrediu')
ok(categories.includes('Categorias padrão não são especiais para o histórico'), 'contrato seguro de categoria padrão regrediu')
ok(categories.includes("safeDelete("), 'categoria não delega proteção relacional ao safeDelete')
ok(categoryOps.includes("category.type !== expected"), 'filtro receita/despesa regrediu')
ok(!projection.includes('minimumDaily'), 'projeção voltou a inventar gasto mínimo')
ok(!projection.includes('weekend'), 'projeção voltou a inventar comportamento de fim de semana')

console.log('DFL FINANCE V36 FINANCIAL CORE: OK')
