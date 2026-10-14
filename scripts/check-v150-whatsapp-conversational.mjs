import fs from "node:fs";

const f = "supabase/functions/whatsapp-webhook/index.ts";
const s = fs.readFileSync(f, "utf8");

const checks = [
  ["segurança compartilhada preservada",
    fs.existsSync("supabase/functions/_shared/requestSecurity.ts") &&
    /trustedWebhook|readBoundedJson|receiptMimeMatches/.test(s)],
  ["Registrar receita reconhecido",
    s.includes("registrar receita") && s.includes('TX_AMOUNT')],
  ["seleção por nome disponível",
    s.includes("function pickNamed")],
  ["contexto conversacional disponível",
    s.includes("function conversationalContext")],
  ["TX conta aceita nome",
    /TX_ACC[\s\S]{0,500}pickNamed/.test(s)],
  ["TX categoria aceita nome",
    /TX_CAT[\s\S]{0,1000}pickNamed/.test(s)],
  ["transferência aceita nome",
    /TR_FROM[\s\S]{0,1000}pickNamed/.test(s) &&
    /TR_TO[\s\S]{0,1000}pickNamed/.test(s)],
  ["iFood receita sem Delivery forçado",
    s.includes('ty==="income"?"Vendas [IFOOD]":"Delivery"')],
  ["histórico contextual de categoria",
    s.includes('select("category_id,description,account_id")')],
  ["menu primário reduzido",
    s.includes("ranked.slice(0,5)")],
  ["legado V16.1 removido",
    !s.includes("fluxo V16.1 preservado para próxima revisão")],
  ["ping não fossilizado",
    !s.includes("Bot Financeiro V141 operacional")],
  ["idempotência de lançamento preservada",
    s.includes("bot_record_transaction") && s.includes("p_idempotency_key")],
  ["settlement preservado",
    s.includes("bot_settle_transaction")],
  ["transferência RPC preservada",
    s.includes("bot_record_transfer")],
  ["comprovante contextual preservado",
    s.includes("TX_SETTLE") && /receipt|comprovante/i.test(s)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`\nV150 BLOQUEADA: ${failed} contrato(s) falharam.`);
  process.exit(1);
}
console.log(`\nV150 CONVERSATIONAL BRAIN: ${checks.length} contratos aprovados.`);
