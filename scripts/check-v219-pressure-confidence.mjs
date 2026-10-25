import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const path='src/app/(app)/cash-pressure/page.tsx'
const s=read(path)
const ast=ts.createSourceFile(
  path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)
assert.equal(ast.parseDiagnostics.length,0)
for(const token of [
  'const scenarioReady=!invalidScenario',
  "loading || !scenarioReady ? 'Aguardando validação'",
  '{(loading || !scenarioReady) ? (',
  'Corrija os campos inválidos',
  'Ainda carregando os dados locais',
  'parsePressureMoney(extra)',
  'parsePressureMoney(cushion)',
  'buildFinancePressure(',
  'buildFinanceAgenda(',
  "setExtra(''); setCushion('')"
]){
  assert.ok(s.includes(token),token)
  console.log('✓',token)
}
assert.ok(read('.github/workflows/android-build.yml')
  .includes('node scripts/check-v219-pressure-confidence.mjs'))
console.log('V219: contratos aprovados.')
