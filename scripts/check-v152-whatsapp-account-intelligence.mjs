import fs from "node:fs";

const file = "supabase/functions/whatsapp-webhook/index.ts";
const s = fs.readFileSync(file, "utf8");

function ok(cond, msg) {
  if (!cond) {
    console.error("✗", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

ok(s.includes("trustedWebhook"), "segurança compartilhada preservada");
ok(s.includes("readBoundedJson"), "JSON limitado preservado");
ok(s.includes("receiptMimeMatches"), "validação de comprovante preservada");

ok(s.includes("let text=String("), "hotfix V151: texto mutável");
ok(s.includes("let n=N(text);"), "hotfix V151: normalização mutável");
ok(!s.includes('Não encontrei o valor. Pode mandar, por exemplo, *300*'), "mensagem robótica antiga removida");

ok(s.includes("function accountsInText"), "resolver de conta no texto presente");
ok(s.includes("function accountAliases"), "aliases controlados presentes");
ok(s.includes('"infinitpay"'), "alias InfinitPay presente");
ok(s.includes('"infinitypay"'), "alias InfinityPay presente");
ok(s.includes('"infinitepay"'), "alias InfinitePay presente");
ok(s.includes("matchedAccount?.context"), "contexto derivado da conta");
ok(s.includes("stripMatchedAccount"), "descrição limpa da conta");
ok(s.includes("identificado pela conta"), "explicabilidade da inferência");
ok(s.includes("account_ambiguous"), "ambiguidade preservada");
ok(s.includes("Encontrei essa conta em mais de um contexto"), "pergunta somente em ambiguidade");

ok(s.includes("TX_SETTLE"), "settlement preservado");
ok(s.includes("bot_record_transaction"), "RPC de lançamento preservada");
ok(s.includes("bot_record_transfer"), "transferência preservada");
ok(s.includes("media.ignored_no_financial_context"), "proteção de mídia solta preservada");
ok(s.includes("categorization_rules"), "aprendizado de categoria preservado");

if (!process.exitCode) {
  console.log("\nV152 ACCOUNT INTELLIGENCE: contratos aprovados.");
}
