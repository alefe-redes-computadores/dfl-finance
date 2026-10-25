import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const read=p=>fs.readFileSync(p,'utf8')
const path='src/app/(app)/planning/page.tsx'
const s=read(path)
const ast=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
assert.equal(ast.parseDiagnostics.length,0)
for(const token of [
  'categorySearch,setCategorySearch',
  'categoryGroup,setCategoryGroup',
  "categoryGroup!=='all'",
  "tokens.every(t=>name.includes(t))",
  'aria-pressed={categoryGroup===value}',
  'displayCategories.length',
  'Cancelar edição e limpar formulário',
  'setEditingId(null);setDraft(blank())',
  'saveReserve=async',
  'removeReserve=async',
  'saveBucket=async',
  'buildFinancePlanning(',
  'planningReservePriorities(data.reserves,now)'
]){
  assert.ok(s.includes(token),token)
  console.log('✓',token)
}
assert.ok(read('.github/workflows/android-build.yml')
  .includes('node scripts/check-v214-planning-usability.mjs'))
console.log('V214: contratos estruturais aprovados.')
