import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const path='src/app/(app)/planning/page.tsx'
const home=read(path)
const flow=read('.github/workflows/android-build.yml')
let count=0
function check(name,yes){
  assert.ok(yes,name)
  console.log('✓',name)
  count++
}

const ast=ts.createSourceFile(path,home,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
check('Sintaxe TSX',ast.parseDiagnostics.length===0)
check('Filtro de urgentes',home.includes("reserveView==='urgent'"))
check('Filtro de todas',home.includes("['all','Todas']"))
check('Filtro de concluídas',home.includes("reserveView==='complete'"))
check('Sem limite artificial de cinco',!home.includes("entries.filter(r=>r.status!=='complete').slice(0,5)"))
check('Filtro por status completo',home.includes("r.status==='complete'"))
check('Botões acessíveis',home.includes('aria-pressed={reserveView===view}'))
check('Quantidades visíveis',home.includes('reserveVisible.length} de {reservePriority.entries.length}'))
check('Edição preservada',home.includes('editReserve(original)'))
check('Cadastro preservado',home.includes('saveReserve=async'))
check('Exclusão preservada',home.includes('removeReserve=async'))
check('Cálculo original preservado',home.includes('buildFinancePlanning('))
check('Nenhum lançamento automático novo',!home.includes('db.transactions.put('))
check('Workflow V212',flow.includes('node scripts/check-v212-reserve-agenda.mjs'))
console.log(`V212: ${count} contratos aprovados.`)
