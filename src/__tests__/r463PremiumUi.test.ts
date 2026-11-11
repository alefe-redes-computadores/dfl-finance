import fs from 'node:fs'

const read = (file: string) => fs.readFileSync(file, 'utf8')

describe('R463 — acabamento visual sem mudança financeira', () => {
  test('Transações não mantém o extrato sob o topo sticky gigante', () => {
    const code = read('src/app/(app)/transactions/page.tsx')
    expect(code).toContain('data-r463-scroll="normal"')
    expect(code).not.toContain('className="sticky top-0 z-40')
    expect(code.indexOf('data-r463-scroll="normal"')).toBeLessThan(code.indexOf('<TransactionsSkeleton'))
    expect(read('src/app/(app)/layout.tsx')).toContain('overflow-y-auto')
  })

  test('Saldo continua acessível, privado e capaz de abrir as transações', () => {
    const code=read('src/app/(app)/home/page.tsx')
    for (const anchor of ['data-r463-balance="compact"','setHideBalance(!hideBalance)','Saldo salvo no dispositivo','Saldo atualizado','formatCurrency(totalAccountsBalance)',"router.push('/transactions')"]) expect(code).toContain(anchor)
  })

  test('Nova despesa mantém edição, anexos, QR e CTA com safe-area', () => {
    const code=read('src/app/(app)/transactions/new/page.tsx')
    for (const anchor of ['setShowQRScanner(true)','setShowReceiptModal(true)','<MoneyInput','<ContextToggle />','handleSave()','isSubmitting || uploading','pb-[max(1.25rem,var(--safe-area-bottom))]']) expect(code).toContain(anchor)
  })

  test('Mais continua com grupos e destinos acessíveis', () => {
    const code=read('src/app/(app)/more/page.tsx')
    expect(code).toContain('data-r463-menu="compact"')
    for (const anchor of ['Contas e empresas','Planejamento e compromissos','Inteligência e relatórios','Sistema, avisos e segurança','href="/commercial"','href="/commercial/mei"','href="/updates"','href="/conciliation"']) expect(code).toContain(anchor)
  })

  test('Análises não inventam barras, mantêm cálculos e não cortam eixo', () => {
    const analysis=read('src/app/(app)/analysis/page.tsx')
    const comparison=read('src/components/dashboard/ComparisonChart.tsx')
    const projection=read('src/components/dashboard/ProjectionChart.tsx')
    expect(analysis).toContain('data-r463-analysis="compact"')
    expect(analysis).toContain('metrics.kpis.burnRate')
    expect(comparison).toContain('const hasValues =')
    expect(comparison).toContain('Sem receitas ou despesas para comparar')
    expect(projection).toContain('formatAxisCurrency(Number(v))')
    expect(projection).toContain('width={72}')
  })

  test('R463 aparece antes de R462 nas novidades e na documentação', () => {
    const notes=read('src/lib/financeReleaseNotes.ts')
    expect(notes.indexOf("version: 'R463'")).toBeLessThan(notes.indexOf("version: 'R462'"))
    const change=read('CHANGELOG.md')
    expect(change.indexOf('## R463')).toBeLessThan(change.indexOf('## R462'))
  })
})
