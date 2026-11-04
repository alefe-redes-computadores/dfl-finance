import assert from 'node:assert/strict';import fs from 'node:fs';
const sql=fs.readFileSync(process.argv[2],'utf8');
const page=fs.readFileSync('src/app/(app)/commercial/ledger/page.tsx','utf8');
for(const needle of ['dfl_commercial_import_batch','security definer','v_owner','jsonb_array_length','on conflict(owner_id,platform_id,reference) do nothing','grant execute','revoke all'])assert.ok(sql.includes(needle),needle);
for(const needle of ['parseCsv','mapSales','mapReceipts','normalizeSales','normalizeReceipts','validateCsv','commitCsv','window.confirm','csvBusy','importReport'])assert.ok(page.includes(needle),needle);
assert.ok(!sql.includes('public.transactions'));assert.ok(!sql.includes('public.accounts'));
console.log('R444: 17 contratos estruturais importação/ledger OFF OK (não substituem PostgreSQL).');
