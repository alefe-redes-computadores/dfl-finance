import fs from 'node:fs'

const read = (f) => fs.readFileSync(f, 'utf8')
const ok = (v, m) => {
  if (!v) throw new Error(`V35: ${m}`)
}

const page = read('src/app/(app)/receipts/page.tsx')
const more = read('src/app/(app)/more/page.tsx')
const exportService = read('src/lib/services/exportService.ts')
const pkg = JSON.parse(read('package.json'))

ok(
  more.includes('Central de Comprovantes') &&
  more.includes('href="/receipts"'),
  'atalho da central ausente'
)

ok(page.includes('groupedReceipts'), 'agrupamento mensal ausente')
ok(page.includes('display_name'), 'nome de apresentação ausente')

ok(
  page.includes('account_name') &&
  page.includes('bank_name'),
  'contexto bancário ausente'
)

ok(
  page.includes('Abrir lançamento'),
  'deep-link para lançamento ausente'
)

ok(
  page.includes("import('@capacitor/browser')"),
  'abertura nativa de comprovante ausente'
)

/*
 * V57 — valida comportamento da busca, não uma frase congelada.
 */
ok(
  page.includes('value={search}') &&
  page.includes('setSearch(event.target.value)') &&
  page.includes('Buscar loja, banco, valor') &&
  page.includes('data'),
  'busca inteligente ausente'
)

ok(
  page.includes('linkFilter') &&
  page.includes("['loose', 'Avulsos']") &&
  page.includes('receipts.length - linkedCount'),
  'suporte a avulsos removido'
)

ok(
  exportService.includes('URL.createObjectURL'),
  'auditoria de export web mudou inesperadamente'
)

ok(
  Boolean(pkg.dependencies?.['@capacitor/browser']),
  '@capacitor/browser necessário para abertura nativa ausente'
)

ok(
  !pkg.dependencies?.['@capacitor/filesystem'] &&
  !pkg.dependencies?.['@capacitor/share'],
  'V35 não deve furar Native Freeze'
)

console.log('DFL FINANCE V35 CENTRAL DE COMPROVANTES: OK')
