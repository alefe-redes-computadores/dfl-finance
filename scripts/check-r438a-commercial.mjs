import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(
  'src/app/(app)/commercial/page.tsx', 'utf8'
)

const more = fs.readFileSync(
  'src/app/(app)/more/page.tsx', 'utf8'
)

for (const name of [
  'dfl_commercial_organizations',
  'dfl_commercial_stores',
  'dfl_commercial_platforms'
]) {
  assert.ok(page.includes(name), `Tabela ausente: ${name}`)
}

assert.ok(page.includes("mode: 'off'"))
assert.ok(page.includes('active: false'))
assert.ok(page.includes('getAcronym'))
assert.ok(page.includes('haptic.success()'))
assert.ok(page.includes('haptic.error()'))
assert.ok(page.includes("showToast("))
assert.ok(more.includes('href="/commercial"'))
assert.ok(!page.includes("from('transactions')"))
assert.ok(!page.includes("from('accounts')"))

console.log('R438-A: contratos básicos aprovados')
