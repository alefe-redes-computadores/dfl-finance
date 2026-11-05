import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'

// Contratos: leitura de arquivos locais, sem acesso a banco ou rede.
const file=(p)=>fs.readFileSync(p,'utf8')
const F1={
 'docs/sql-candidates/gate-f-f1-debt-payment-proposal.sql':'f09a534630090d41ef9cdab190c3609db824e4aaa6f766ca5d962b8b7ffa67df',
 'docs/gate-f/F1-ESCOPO-E-RISCOS.md':'eab65588c6b2b5ece5c1be43499ef33e6ac5f8244696c8ccb1b2f249241f5af2',
 'scripts/check-gatef-f1-debt-payment.mjs':'9d69210ee8be2b9eadde16549dee145bd6a38bc5b2cd892443ac55e72c0e4b02',
 'scripts/check-gatef-f1-sale-identity.mjs':'d8b6b5bec8d2ae28e0c6aa7be09cb570addf4b5c8b5be8127f288a313154ca22',
 'scripts/check-gatef-f1-readonly-contract.mjs':'cc41351f5d2071d501cf7cb0ae2801ce9345d41a18e8fadf6afcc901fa793466',
}
let n=0
const check=(name,run)=>{run();n++;console.log('OK:',name)}
check('F1-R2 preservada bit a bit, inclusive testes de pagamento e identidade',()=>{
 for(const [path,hash] of Object.entries(F1)){
   const actual=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')
   assert.equal(actual,hash,`Arquivo F1 divergente: ${path}`)
 }
})
check('F1-R2 continua fora de supabase/migrations',()=>{
 assert.ok(!fs.existsSync('supabase/migrations/gate-f-f1-debt-payment-proposal.sql'))
 assert.ok(!fs.existsSync('supabase/migrations/gate-f-f2-consultas-readonly.sql'))
})
check('Status nao expande os checks de debts em producao',()=>{
 const sql=file('docs/sql-candidates/gate-f-f1-debt-payment-proposal.sql')
 assert.match(sql,/DFL_PAYMENT_IDEMPOTENCY_CONFLICT/)
 assert.match(sql,/FOR UPDATE/i)
 assert.doesNotMatch(sql,/\b(?:cancelled|disputed|frozen)\b/i)
})
check('Identidade canônica futura e estritamente manual, sem dedupe por telefone',()=>{
 const docs=file('docs/gate-f/F2-STAGING-E-PONTE-OFF.md')
 assert.match(docs,/site:<order_id>/)
 assert.match(docs,/entregas:<internal_order_id>/)
 assert.match(docs,/merchant_id\s*\+\s*sale_key\s*\+\s*receivable_kind/)
 assert.match(docs,/OFF/)
})
check('Consultas de reconciliacao sao somente SELECT e nao contem URLs',()=>{
 const sql=file('docs/sql-candidates/gate-f-f2-consultas-readonly.sql')
 assert.equal((sql.match(/^-- GATE_F2_QUERY:/gm)||[]).length,5)
 assert.doesNotMatch(sql,/https?:\/\/|supabase\.co|\b(?:http_post|dblink)\b/i)
 const blocks=sql.split(/^-- GATE_F2_QUERY:[A-Z]+\r?\n/gm).slice(1)
 assert.equal(blocks.length,5)
 for(const b of blocks){const v=b.replace(/^--.*$/gm,'').replace(/'(?:''|[^'])*'/g,"''").trim()
   assert.match(v,/^(WITH|SELECT)\b/i)
   assert.doesNotMatch(v,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|CALL|DO|PERFORM)\b/i)
 }
})
check('PGlite isolado, sem imports de clientes Supabase',()=>{
 for(const p of ['scripts/check-gatef-f2-rls.mjs','scripts/check-gatef-f2-ledger.mjs']){
  const s=file(p)
  assert.match(s,/from '@electric-sql\/pglite'/)
  assert.doesNotMatch(s,/from ['"]@supabase\/supabase-js|fetch\(|https?:\/\/|\.env|SUPABASE_URL|SERVICE_ROLE_KEY/i)
 }
})
check('Staging separado e ainda nao certificado',()=>{
 const s=file('docs/gate-f/F2-STAGING-E-PONTE-OFF.md')
 assert.match(s,/ainda não realizados/i)
 assert.match(s,/sem dados financeiros nem mensagens reais|Não usar dados financeiros nem mensagens reais/i)
 const s2=file('docs/gate-f/F2-ESCOPO-E-SEGURANCA.md')
 assert.match(s2,/BLOQUEADO/)
})
console.log(`DFL FINANCE GATE F F2: ${n} contratos estaticos aprovados.`)
