import fs from 'node:fs'
const read=f=>fs.readFileSync(f,'utf8')
const ok=(v,m)=>{if(!v)throw new Error(m)}
const home=read('src/app/(app)/home/page.tsx')
const conci=read('src/app/(app)/conciliation/page.tsx')

ok(home.includes("const pendingMonthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd')"),'Home sem horizonte mensal')
ok(home.includes("tx.status !== 'pending'"),'Home sem filtro pending')
ok(home.includes("date <= pendingMonthEnd"),'Home ainda pode somar meses futuros')

ok(conci.includes("tx.source === 'whatsapp'"),'Origem WhatsApp ausente')
ok(conci.includes("tx.source === 'ofx_import' || tx.source === 'ofx_merged'"),'Origem OFX ausente')
ok(conci.includes("tx.source === 'ai_ocr'"),'Origem OCR ausente')
ok(conci.includes("const shouldApplyBalance = tx.affects_balance !== true"),'Trava idempotente ausente')
ok(conci.includes("if (shouldApplyBalance)"),'Aplicação de saldo sem guarda')
ok(conci.includes("affects_balance: true"),'Consolidação affects_balance ausente')
ok(conci.includes("date <= monthEnd"),'Conciliação inclui meses futuros')
console.log('V25 INTEGRITY CONTRACTS OK')
