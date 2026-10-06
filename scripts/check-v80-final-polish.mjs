import fs from 'node:fs'

const read = (f) => fs.readFileSync(f, 'utf8')
const ok = (condition, message) => {
  if (!condition) {
    console.error(`ERRO: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`OK: ${message}`)
  }
}

const fab = read('src/components/FAB.tsx')
const bank = read('src/components/BankLogo.tsx')
const optical = read('src/lib/bankIdentityPresentation.ts')
const nav = read('src/components/BottomNav.tsx')
const fresh = read('src/app/(app)/transactions/new/page.tsx')
const gallery = read('src/app/(app)/receipts/page.tsx')
const search = read('src/lib/globalSearch.ts')
const css = read('src/app/globals.css')

ok(
  fab.includes("const selected = category === c.label") &&
  fab.includes("text-teal-800 dark:text-teal-300") &&
  fab.includes("Selecionada"),
  'Ação Rápida evidencia categoria selecionada',
)

ok(
  bank.includes("transform: `translate(${optical.x ?? 0}px, ${optical.y ?? 0}px) scale(${optical.scale})`"),
  'assets SVG recebem perfil óptico compartilhado',
)

ok(
  /pagbank:\s*{\s*[\s\S]*?scale:\s*0\.72/.test(optical),
  'PagBank possui escala óptica compacta',
)

ok(
  /stone:\s*{\s*[\s\S]*?scale:\s*0\.74/.test(optical),
  'Stone possui escala óptica compacta',
)

ok(
  nav.includes("navigateSafely('/transactions/new')"),
  'Transações abre Nova Transação completa',
)

ok(
  fresh.includes("const [date, setDate") &&
  fresh.includes("const [notes, setNotes") &&
  fresh.includes("const [selectedTags, setSelectedTags") &&
  fresh.includes("stagedReceiptUrlRef.current = uploaded.path") &&
  fresh.includes("receipt_url: i === 0 ? receiptUrl : null"),
  'Nova Transação rica e comprovante privado preservados',
)

ok(
  gallery.includes("showToast('Comprovante excluído.', 'success')") &&
  gallery.includes('setReceipts((current) =>'),
  'Galeria mantém exclusão otimista',
)

ok(
  search.includes('editDistanceAtMostOne') &&
  search.includes('resolveMonthIntentToken'),
  'Busca 2.1 tolerante permanece ativa',
)

ok(
  css.includes("button:focus-visible") &&
  css.includes("[role='button']:focus-visible"),
  'foco acessível permanece restrito aos controles adequados',
)

if (process.exitCode) process.exit(process.exitCode)
console.log('\nV80 FINAL POLISH: CONTRATOS OK')
