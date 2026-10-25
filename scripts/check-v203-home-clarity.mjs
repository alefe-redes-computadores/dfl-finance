import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path='src/app/(app)/home/page.tsx'
const s=fs.readFileSync(path,'utf8')
const workflow=fs.readFileSync(
  '.github/workflows/android-build.yml','utf8'
)

let n=0
const check=(name,condition)=>{
  assert.ok(condition,name)
  console.log('✓',name)
  n++
}

const ast=ts.createSourceFile(
  path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)

check('TSX valido',ast.parseDiagnostics.length===0)
check('Mes e ano juntos',s.includes("'MMMM yyyy'"))
check('Localizacao brasileira preservada',s.includes('locale: ptBR'))
check('Navegacao anterior preservada',s.includes('subMonths(previous, 1)'))
check('Navegacao seguinte preservada',s.includes('addMonths(previous, 1)'))
check('Disponivel operacional mantido',s.includes('formatCurrency(operationalAvailable)'))
check('Saldo pode ficar oculto',s.includes("hideBalance ? '••••'"))
check('Deficit explicado',s.includes('Compromissos imediatos superam o saldo disponível'))
check('Saldo positivo explicado',s.includes('Saldo menos compromissos imediatos'))
check('Atalho contas preservado',s.includes("router.push('/accounts')"))
check('Inbox preservada',s.includes("router.push('/conciliation')"))
check('Revisoes preservadas',s.includes('pendings.reviewCount'))
check('Pendencias preservadas',s.includes('pendings.actionableCount'))
check('Status sync preservado',s.includes('hasSyncFailure'))
check('Reconciliacao preservada',s.includes('reconcileBalance'))
check('Home segue isolada por contexto',s.includes('effectiveContext'))
check('Avisos sync preservados',s.includes('lastSyncError'))
check('Workflow V203 ativo',workflow.includes('node scripts/check-v203-home-clarity.mjs'))

console.log(`V203: ${n} contratos aprovados.`)
