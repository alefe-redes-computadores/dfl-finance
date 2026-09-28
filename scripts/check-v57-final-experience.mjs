import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const helper = read('src/lib/receiptOperations.ts')
const imports = read('src/lib/importOperations.ts')
const importPage = read('src/app/(app)/import/page.tsx')
const newPage = read('src/app/(app)/transactions/new/page.tsx')
const details = read('src/app/(app)/transactions/details/page.tsx')
const receipts = read('src/app/(app)/receipts/page.tsx')

const failures = []
function ok(condition, message) {
  if (condition) console.log(`OK: ${message}`)
  else { console.error(`ERRO: ${message}`); failures.push(message) }
}

console.log('=== V57 FINAL EXPERIENCE & IMPORT INTEGRITY ===')

ok(helper.includes('RECEIPT_MAX_BYTES = 10 * 1024 * 1024'), 'limite de comprovante centralizado')
ok(helper.includes("'image/jpeg'") && helper.includes("'application/pdf'"), 'tipos aceitos centralizados')
ok(helper.includes("storage.from('receipts').upload"), 'upload de comprovante centralizado')
ok(helper.includes("resolveApiUrl('/api/ocr-receipt')"), 'OCR centralizado')
ok(helper.includes('findReceiptCategoryId'), 'categoria sugerida usa normalização central')

for (const [name, source] of [
  ['import', importPage],
  ['nova transação', newPage],
  ['detalhes', details],
]) {
  ok(!source.includes("storage.from('receipts').upload"), `${name} não duplica upload direto`)
  ok(!source.includes("resolveApiUrl('/api/ocr-receipt')"), `${name} não duplica chamada OCR`)
}

ok(importPage.includes('stagedReceiptPathRef') && importPage.includes('committedReceiptPathRef'), 'importação limpa upload abandonado sem apagar comprovante salvo')
ok(newPage.includes('stagedReceiptUrlRef') && newPage.includes('committedReceiptUrlRef'), 'nova transação protege comprovante temporário')
ok(details.includes('originalReceiptUrlRef') && details.includes('stagedReceiptUrlRef'), 'edição distingue comprovante original de upload temporário')
ok(details.includes('originalReceiptUrl && originalReceiptUrl !== receiptUrl'), 'edição só remove arquivo antigo depois do salvamento')
ok(!details.includes(".eq('status', 'pending')\n                .eq('type', 'expense')"), 'OCR em detalhes não tenta relinkar silenciosamente outro lançamento')
ok(details.includes('Os dados atuais do lançamento foram preservados'), 'OCR em edição preserva dados financeiros existentes')

ok(imports.includes('stableImportHash'), 'importação possui assinatura estável')
ok(imports.includes('batchOccurrences'), 'importação preserva ocorrências idênticas legítimas')
ok(imports.includes('existingIdempotencyKeys'), 'reimportação reconhece identidade persistida')
ok(imports.includes('`import:${source}:${stableImportHash(signature)}:${occurrence}`'), 'idempotency_key é determinística por origem/assinatura/ocorrência')

ok(receipts.includes('uploadReceiptFile({ userId: user.id, file })'), 'Central usa upload compartilhado')
ok(receipts.includes('await removeReceiptFile(receipt.path)'), 'Central usa remoção compartilhada')

if (failures.length) {
  console.error(`\nV57 FALHOU: ${failures.length} contrato(s).`)
  process.exit(1)
}
console.log('\nV57 FINAL EXPERIENCE & IMPORT INTEGRITY: OK')
