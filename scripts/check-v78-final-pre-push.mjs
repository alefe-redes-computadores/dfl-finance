import fs from 'node:fs'

const read = p => fs.readFileSync(p, 'utf8')
const fail = m => { console.error(`ERRO: ${m}`); process.exitCode = 1 }
const ok = m => console.log(`OK: ${m}`)
const check = (c,m) => c ? ok(m) : fail(m)

const txNew = read('src/app/(app)/transactions/new/page.tsx')
const css = read('src/app/globals.css')
const receipts = read('src/lib/receiptOperations.ts')
const presentation = read('src/lib/receiptPresentation.ts')
const gallery = read('src/app/(app)/receipts/page.tsx')
const search = read('src/lib/globalSearch.ts')

check(!txNew.includes('z-[99999]'), 'overlays legados z-[99999] removidos da Nova Transação')
check((txNew.match(/app-overlay z-\[150000\]/g) || []).length === 10, '10 sheets usam overlay global e camada consistente')
check(txNew.includes('var(--safe-area-top)'), 'sheets respeitam altura útil e safe-area superior')
check(css.includes('.app-overlay') && css.includes('.app-sheet-panel'), 'primitives globais de overlay/sheet preservados')
check(css.includes('var(--safe-area-bottom)'), 'safe-area inferior global preservada')
check(!receipts.includes(".getPublicUrl("), 'receiptOperations não ressuscitou URL pública')
check(presentation.includes('getReceiptStoragePath'), 'compatibilidade de comprovante legado preservada')
check(!gallery.includes(".getPublicUrl("), 'Galeria continua sem fallback público')
check(search.includes('searchFinancialData'), 'motor de Busca Global preservado')
check(search.includes('normalizeMoneyQuery') || search.includes('money'), 'Busca 2.0 mantém normalização monetária')

if (process.exitCode) process.exit(process.exitCode)
console.log('\nV78 FINAL PRE-PUSH: CONTRATOS OK')
