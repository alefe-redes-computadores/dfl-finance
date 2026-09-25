import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V35.1: ${message}`)
}

const page = read('src/app/(app)/receipts/page.tsx')
const helper = read('src/lib/receiptPresentation.ts')
const more = read('src/app/(app)/more/page.tsx')
const pkg = JSON.parse(read('package.json'))

ok(more.includes('Central de Comprovantes'), 'atalho da Central desapareceu')
ok(page.includes('ReceiptViewer'), 'visualizador fullscreen ausente')
ok(page.includes('aspect-[4/5]'), 'grid visual premium ausente')
ok(page.includes('object-cover'), 'miniaturas reais ausentes')
ok(page.includes('setZoom'), 'zoom do visualizador ausente')
ok(page.includes('onTouchMove'), 'pinch zoom ausente')
ok(page.includes('Abrir / salvar'), 'ação abrir/salvar ausente')
ok(page.includes("import('@capacitor/browser')"), 'fallback nativo Browser ausente')
ok(page.includes('linkFilter'), 'filtro vinculados/avulsos ausente')
ok(page.includes('transaction_amount'), 'valor da transação ausente')
ok(page.includes('bank_name'), 'contexto bancário ausente')
ok(helper.includes('stripReceiptExtension'), 'proteção visual de extensão ausente')
ok(helper.includes('normalizeReceiptDisplayName'), 'normalizador de nomes ausente')
ok(helper.includes('buildReceiptSmartName'), 'nome inteligente ausente')
ok(!page.includes('receipt.name}</p>'), 'nome físico voltou a ser exibido')
ok(Boolean(pkg.dependencies?.['@capacitor/browser']), '@capacitor/browser ausente')
ok(!pkg.dependencies?.['@capacitor/filesystem'], 'V35.1 não deve furar Native Freeze com Filesystem')
ok(!pkg.dependencies?.['@capacitor/share'], 'V35.1 não deve furar Native Freeze com Share')

console.log('DFL FINANCE V35.1 RECEIPTS PREMIUM: OK')
