import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dfl-r441-'))
try {
  for (const name of ['commercialSettlement','commercialBatch','commercialImport']) {
    const input = fs.readFileSync(`src/lib/${name}.ts`, 'utf8')
    const output = ts.transpileModule(input, { fileName: name+'.ts', compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } })
    fs.writeFileSync(path.join(temp, name+'.js'), output.outputText)
  }
  const batch = require(path.join(temp, 'commercialBatch.js'))
  const imp = require(path.join(temp, 'commercialImport.js'))
  const saleCsv = 'id;dia;valor;taxa\nA;2026-11-01;100,00;10,00\nB;2026-11-02;50,00;0,00\n'
  const table = imp.parseCsv(saleCsv)
  assert.equal(table.rows.length, 2)
  const sales = batch.normalizeSales(imp.mapSales(table, { reference:'id', date:'dia', gross:'valor', commission:'taxa' }))
  assert.equal(sales[0].settlement.payableCents, 9000)
  assert.equal(sales[1].settlement.payableCents, 5000)
  const receipts = batch.normalizeReceipts(imp.mapReceipts(imp.parseCsv('ref;date;amount\nR1;2026-11-03;140,00\n'), {reference:'ref',date:'date',amount:'amount'}))
  assert.equal(batch.reconcile(sales, receipts, ['A','B'], ['R1']).status, 'matched')
  assert.equal(batch.summary(sales,receipts).differenceCents, 0)
  assert.equal(batch.reconcile(sales, [{...receipts[0],amountCents:10000}], ['A','B'], ['R1']).status, 'partial')
  assert.equal(batch.reconcile(sales, [{...receipts[0],amountCents:15000}], ['A','B'], ['R1']).status, 'overpaid')
  assert.throws(() => batch.normalizeSales([sales[0],sales[0]]), /duplicada/)
  assert.throws(() => batch.normalizeReceipts([receipts[0],receipts[0]]), /duplicado/)
  assert.throws(() => batch.reconcile(sales,receipts,['A','A'],['R1']), /repetidas/)
  assert.throws(() => batch.validateDate('2026-02-30'), /Data inválida/)
  assert.throws(() => imp.parseCsv('a;b\n1'), /colunas/)
  assert.throws(() => imp.parseCsv('a;b\n"x;y'), /aspas/)
  assert.equal(imp.parseCsv('a;b\n"x;y";2').rows[0][0], 'x;y')
  assert.equal(imp.parseCsv('a;b\n"x""y";2').rows[0][0], 'x"y')
  assert.throws(() => imp.mapSales(table,{reference:'id',date:'dia',gross:'valor',commission:'id'}), /Linha 2/)
  console.log('R441: 15 contratos de cálculo, CSV, dedupe e conciliação OK')
} finally { fs.rmSync(temp, {recursive:true,force:true}) }
