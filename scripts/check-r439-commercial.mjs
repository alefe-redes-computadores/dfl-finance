import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(
  'src/app/(app)/commercial/overview/page.tsx', 'utf8'
)
const lib = fs.readFileSync(
  'src/lib/commercialExport.ts', 'utf8'
)
const entry = fs.readFileSync(
  'src/app/(app)/commercial/page.tsx', 'utf8'
)

for (const table of [
  'dfl_commercial_organizations',
  'dfl_commercial_stores',
  'dfl_commercial_platforms',
  'dfl_commercial_module_settings'
]) {
  assert.ok(page.includes(table), `Tabela ausente: ${table}`)
}

assert.ok(page.includes("!loadError"))
assert.ok(page.includes('downloadCommercialCsv(rows)'))
assert.ok(page.includes('modulesOff'))
assert.ok(page.includes('platformsOff'))
assert.ok(lib.includes('replace(/"/g'))
assert.ok(lib.includes('csvSafe'))
assert.ok(entry.includes("router.push('/commercial/overview')"))
assert.ok(!page.includes(".insert("))
assert.ok(!page.includes(".update("))
assert.ok(!page.includes(".delete("))

console.log('R439: contratos estruturais aprovados')
