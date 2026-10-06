import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')
const check = (condition, message) => {
  if (!condition) {
    console.error(`ERRO: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`OK: ${message}`)
  }
}

const gallery = read('src/app/(app)/receipts/page.tsx')
const search = read('src/lib/globalSearch.ts')
const css = read('src/app/globals.css')
const nav = read('src/components/BottomNav.tsx')
const bank = read('src/components/BankLogo.tsx')
const optical = read('src/lib/bankIdentityPresentation.ts')

check(
  gallery.includes('const galleryFiles = rawFiles.filter') &&
  gallery.includes("file.path.startsWith(`${user.id}/whatsapp/`)") &&
  gallery.includes('transactionByPath.has(file.path)'),
  'WhatsApp sem vínculo financeiro fica fora da Galeria',
)

check(
  gallery.includes('setReceipts((current) =>') &&
  gallery.includes("showToast('Comprovante excluído.', 'success')"),
  'exclusão de comprovante é otimista com feedback',
)

const deleteStart = gallery.indexOf('const confirmDeleteReceipt')
const deleteEnd = gallery.indexOf('const filteredReceipts', deleteStart)
const deleteBlock = gallery.slice(deleteStart, deleteEnd)

check(
  !deleteBlock.includes('await loadReceipts()'),
  'exclusão bem-sucedida não recarrega toda a Galeria',
)

check(
  search.includes('editDistanceAtMostOne') &&
  search.includes('fuzzyTokenMatch') &&
  search.includes('resolveMonthIntentToken'),
  'Busca 2.1 possui typo controlado e mês tolerante',
)

check(
  search.includes('else if (fuzzyTokenMatch(token, haystack)) score += 1'),
  'match aproximado pontua abaixo do match exato',
)

check(
  !css.includes(':focus-visible { outline: 2px solid rgb(13 148 136 / 0.75); outline-offset: 2px; }') &&
  css.includes("button:focus-visible") &&
  css.includes("[role='button']:focus-visible"),
  'focus global não desenha retângulo extra em inputs',
)

check(
  nav.includes("navigateSafely('/transactions/new')"),
  'FAB mantém rota para Nova Transação completa',
)

check(
  bank.includes('findBankIdentity') &&
  optical.includes('pagbank:') &&
  optical.includes('stone:'),
  'identidade bancária Stone/PagBank permanece registrada',
)

check(
  gallery.includes('listReceiptStorageTree') &&
  !gallery.includes('.getPublicUrl('),
  'privacidade V77 da Galeria permanece intacta',
)

if (process.exitCode) process.exit(process.exitCode)
console.log('\nV79 FINAL UX: CONTRATOS OK')
