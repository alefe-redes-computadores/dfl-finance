import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'

const root = 'src/app/(app)'
const pages = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filename = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      walk(filename)
    } else if (entry.name === 'page.tsx') {
      pages.push(filename)
    }
  }
}

walk(root)

assert.ok(pages.length >= 60, 'Inventário incompleto')

const results = pages.map((filename) => {
  const source = fs.readFileSync(filename, 'utf8')

  const ast = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  assert.equal(
    ast.parseDiagnostics.length,
    0,
    'Falha TSX em ' + filename
  )

  return {
    filename,
    lines: source.split('\n').length,
    bytes: Buffer.byteLength(source),
    sticky: (source.match(/\bsticky\b/g) || []).length,
    cards: (source.match(/rounded-\[(?:18|20|22|24|26)px\]/g) || []).length,
    disclosures: (source.match(/<details\b|aria-expanded=/g) || []).length,
    headings: (source.match(/<h[1-3]\b/g) || []).length,
  }
})

results.sort((a, b) => b.bytes - a.bytes)

const report = [
  'R409 — TOMOGRAFIA VISUAL DFL FINANCE',
  `Páginas inspecionadas: ${pages.length}`,
  '',
  'Páginas mais extensas (código, não altura renderizada):',
  ...results.slice(0, 20).map((item) =>
    [
      item.filename,
      `${item.lines} linhas`,
      `${item.headings} títulos`,
      `${item.cards} padrões de card`,
      `${item.disclosures} controles de expansão`,
    ].join(' | ')
  ),
  '',
  'Revisões manuais futuras prioritárias:',
  ...results
    .filter((item) => item.bytes > 30000)
    .slice(0, 15)
    .map((item) => `- ${item.filename}`),
  '',
  'Atenção: métricas do código não medem rolagem real.',
  'Homologar visualmente em PWA e APK antes do fechamento.',
].join('\n')

if (process.argv[2]) {
  fs.writeFileSync(process.argv[2], report + '\n')
}

const read = (filename) => fs.readFileSync(filename, 'utf8')

const more = read('src/app/(app)/more/page.tsx')
const analysis = read('src/app/(app)/analysis/page.tsx')
const reports = read('src/app/(app)/reports/page.tsx')
const home = read('src/app/(app)/home/page.tsx')
const txNew = read('src/app/(app)/transactions/new/page.tsx')
const txDetail = read('src/app/(app)/transactions/details/page.tsx')
const workflow = read('.github/workflows/android-build.yml')

assert.equal(
  (more.match(/<details\b/g) || []).length >= 4,
  true,
  'Quatro grupos do Mais devem ser recolhíveis'
)

assert.ok(more.includes('Atalhos frequentes'))
assert.ok(more.includes("href=\"/accounts\""))
assert.ok(more.includes("href=\"/assistant\""))
assert.ok(more.includes("href=\"/conciliation\""))
assert.ok(more.includes('Sair do aplicativo'))

assert.ok(analysis.includes('Saúde e planejamento completo'))
assert.ok(analysis.includes('FinancialHealthCenter'))
assert.ok(analysis.includes('Sinais do contexto atual'))

assert.ok(reports.includes('Mais gráficos: categorias e saldo diário'))
assert.ok(reports.includes('filterOptions.find('))
assert.ok(reports.includes('Exportar relatório'))
assert.ok(reports.includes('totalIncome'))
assert.ok(reports.includes('totalExpense'))

assert.ok(home.includes('openPersonalize'))
assert.ok(home.includes('showAllHomePriorities'))

assert.ok(txNew.includes('showDetails'))
assert.ok(txDetail.includes('showDetails'))

assert.ok(
  workflow.includes('node scripts/check-r409-visual-hierarchy.mjs'),
  'Workflow precisa executar a R409'
)

console.log(report)
console.log('\nR409: hierarquia visual e integridade TSX aprovadas')
