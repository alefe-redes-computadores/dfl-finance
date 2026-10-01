import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const ok = (value, message) => {
  if (!value) throw new Error(`V71: ${message}`)
}

const page = read('src/app/(app)/conciliation/page.tsx')
const operations = read('src/lib/conciliationOperations.ts')
const imports = read('src/lib/importOperations.ts')
const receipt = read('src/app/(app)/import/page.tsx')
const csv = read('src/app/(app)/import-csv/page.tsx')

ok(page.includes("date <= today"), 'futuras não estão explicitamente fora da conciliação')
ok(page.includes("filter === 'review'"), 'filtro Para revisar ausente')
ok(page.includes('Caixa de revisão financeira'), 'nova identidade da Conciliação ausente')
ok(page.includes('createPortal'), 'sheet de revisão ausente')
ok(page.includes('saveConciliationReview'), 'edição inline não usa operação segura')
ok(page.includes('conciliatePendingTransaction'), 'conciliação não usa operação atômica')
ok(!page.includes('useConciQueue'), 'fila localStorage antiga ainda governa a tela')
ok(!page.includes('ConciCard'), 'card swipe antigo ainda governa a tela')

ok(imports.includes("status: 'pending'"), 'importação ainda nasce concluída')
ok(imports.includes('affects_balance: false'), 'importação ainda afeta saldo antes da revisão')
ok(imports.includes('const balanceDelta = 0'), 'importação ainda calcula efeito imediato no saldo')
ok(imports.includes("source === 'receipt' ? 'ai_ocr' : 'ofx_import'"), 'origem de importação não é rastreável')

ok(operations.includes("db.transaction('rw', db.transactions, db.accounts, db.syncQueue"), 'conciliação não é atômica')
ok(operations.includes("const shouldApplyBalance = tx.affects_balance !== true"), 'proteção contra dupla aplicação ausente')
ok(operations.includes("status: 'done' as const"), 'conciliação não conclui transação')
ok(operations.includes('addToSyncQueue'), 'syncQueue não está protegida')
ok(operations.includes('category.type !=='), 'categoria incompatível não é validada')

ok(receipt.includes("router.push('/conciliation')"), 'comprovante não leva à revisão')
ok(receipt.includes('saldo será atualizado após a conciliação'), 'mensagem do comprovante ainda promete saldo imediato')
ok(csv.includes('O saldo ainda não foi alterado'), 'CSV não comunica revisão antes do saldo')

const forbiddenEmoji = /[\u{1F300}-\u{1FAFF}]/u
ok(!forbiddenEmoji.test(page), 'emoji encontrado na nova UI da Conciliação')

console.log('V71 CONCILIATION COMPLETE — CONTRATO OK')
