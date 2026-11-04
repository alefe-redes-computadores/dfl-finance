import assert from 'node:assert/strict'
import fs from 'node:fs'
const page=fs.readFileSync('src/app/(app)/commercial/operation/page.tsx','utf8')
const lib=fs.readFileSync('src/lib/commercialSession.ts','utf8')
for(const phrase of ['importSession(await file.text())','normalizeSales(restored.sales)','normalizeReceipts(restored.receipts)','setMatches(restored.matches)','window.confirm','exportSession(sales, receipts, matches)']) assert.ok(page.includes(phrase),phrase)
for(const phrase of ['normalizeSales(raw.sales)','normalizeReceipts(raw.receipts)','reconcile(sales, receipts','Conciliação adulterada','Venda conciliada mais de uma vez','Repasse conciliado mais de uma vez','Sessão excede limite','simulation: true']) assert.ok(lib.includes(phrase),phrase)
assert.ok(!lib.includes('localStorage'))
assert.ok(!lib.includes('supabase'))
console.log('R442: 16 contratos de restauração e isolamento OK')
