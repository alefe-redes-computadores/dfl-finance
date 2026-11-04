import assert from 'node:assert/strict'
import fs from 'node:fs'
const page = fs.readFileSync('src/app/(app)/commercial/operation/page.tsx','utf8')
const lib = fs.readFileSync('src/lib/commercialBatch.ts','utf8')
const importer = fs.readFileSync('src/lib/commercialImport.ts','utf8')
const home = fs.readFileSync('src/app/(app)/commercial/page.tsx','utf8')
for (const term of ['normalizeSales','normalizeReceipts','reconcile','summary','setMatches','mapSales','mapReceipts','parseCsv','Exportar JSON','Desfazer vínculo local']) assert.ok(page.includes(term),term)
for (const term of ['Number.isSafeInteger','Set','payableCents','differenceCents']) assert.ok(lib.includes(term),term)
for (const term of ['5.000','2 MB','Cabeçalhos','aspas não fechadas']) assert.ok(importer.includes(term),term)
assert.ok(home.includes("router.push('/commercial/operation')"))
for (const forbidden of ['supabase','localStorage','sessionStorage','fetch(','.insert(','.update(','.delete(']) assert.ok(!page.includes(forbidden), 'Proibido no laboratório: '+forbidden)
console.log('R441: contratos estruturais OFF e isolamento local OK')
