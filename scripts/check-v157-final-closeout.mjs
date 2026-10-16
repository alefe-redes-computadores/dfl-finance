import fs from 'node:fs'

const webhook = fs.readFileSync(
  'supabase/functions/whatsapp-webhook/index.ts',
  'utf8',
)
const v150 = fs.readFileSync(
  'scripts/check-v150-whatsapp-conversational.mjs',
  'utf8',
)
const bank = fs.readFileSync('src/lib/bankRegistry.ts', 'utf8')

let failures = 0

function ok(condition, label) {
  if (condition) {
    console.log(`✓ ${label}`)
  } else {
    failures += 1
    console.error(`✗ ${label}`)
  }
}

console.log('V157 FINAL CLOSEOUT — contratos')

ok(
  webhook.includes('V157_HELD_RECEIPT_CLEANED'),
  'limpeza de comprovante temporário existe',
)

ok(
  webhook.includes('V157_HELD_RECEIPT_REPLACED'),
  'substituição de comprovante temporário é tratada',
)

ok(
  webhook.includes('V157_HELD_RECEIPT_CLEANUP_ERROR'),
  'falha de limpeza é observável sem corromper sessão',
)

ok(
  /const clear=async\(p:string\)=>[\s\S]*held_receipt_path[\s\S]*cleanupHeldReceipt/.test(webhook),
  'clear centraliza ciclo de vida do comprovante',
)

ok(
  /cleanupHeldReceipt=async[\s\S]*transactions[\s\S]*receipt_url[\s\S]*storage[\s\S]*receipts[\s\S]*remove/.test(webhook),
  'limpeza protege comprovante já vinculado antes de remover Storage',
)

ok(
  /if\(canHoldReceipt\)[\s\S]*previousHeld[\s\S]*cleanupHeldReceipt\(previousHeld\)[\s\S]*held_receipt_path:path/.test(webhook),
  'novo comprovante limpa o temporário anterior antes da substituição',
)

ok(
  webhook.includes('if(!sd.recurrence&&txid&&sd.held_receipt_path)'),
  'vínculo de comprovante em transação normal preservado',
)

ok(
  /if\(!sd\.recurrence&&txid\)await save\(phone,"TX_SETTLE"[\s\S]*else await clear\(phone\)/.test(webhook),
  'recorrência só encerra sessão depois do RPC de criação',
)

ok(
  webhook.includes('action:"session.cancel"') &&
    webhook.includes('await clear(phone)'),
  'cancelamento passa pela limpeza central',
)

ok(
  webhook.includes('freshTransactionIntent') &&
    /freshTransactionIntent\)\{await clear\(phone\)/.test(webhook),
  'restart passa pela limpeza central',
)

ok(
  webhook.includes('bot_settle_transaction'),
  'settlement financeiro preservado',
)

ok(
  webhook.includes('bot_record_transfer'),
  'transferência first-class preservada',
)

ok(
  webhook.includes('trustedWebhook') &&
    webhook.includes('readBoundedJson') &&
    webhook.includes('receiptMimeMatches'),
  'segurança do webhook preservada',
)

ok(
  webhook.includes('ty==="income"?"Vendas {IFOOD}":"Delivery"'),
  'contrato iFood atual preservado',
)

ok(
  !v150.includes('Vendas [IFOOD]') &&
    v150.includes('Vendas {IFOOD}'),
  'gate V150 deixou de exigir contrato fossilizado',
)

ok(
  bank.includes(
    `asset('/banks/stone-current.svg', '#FFFFFF', 'h-[64%] w-[78%] object-contain', 'official-source', 'stone.com.br')`,
  ),
  'Stone usa asset central sem filtro destrutivo',
)

if (failures) {
  console.error(`\nV157: ${failures} contrato(s) falharam.`)
  process.exit(1)
}

console.log('\nV157 FINAL CLOSEOUT: CONTRATOS OK')
