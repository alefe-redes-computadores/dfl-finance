import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const p='src/app/(app)/home/page.tsx'
const s=fs.readFileSync(p,'utf8')
const flow=fs.readFileSync('.github/workflows/android-build.yml','utf8')
let n=0
const check=(name,result)=>{
  assert.ok(result,name)
  console.log('✓',name)
  n++
}

const ast=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
check('TSX valido',ast.parseDiagnostics.length===0)
check('Detalhe recolhivel',s.includes('showOperationalDetail'))
check('Controle acessivel',s.includes('aria-expanded={showOperationalDetail}'))
check('Associacao painel',s.includes('aria-controls="operational-detail-v205"'))
check('Botao funciona',s.includes('setShowOperationalDetail(value => !value)'))
check('Saldo de contas visivel sob autorizacao',s.includes('formatCurrency(totalAccountsBalance)'))
check('Compromissos identificados',s.includes('formatCurrency(operationalCommitted)'))
check('Disponivel identificado',s.includes('formatCurrency(operationalAvailable)'))
check('Tres valores respeitam privacidade',
  (s.match(/hideBalance \? '••••' : formatCurrency\((?:totalAccountsBalance|operationalCommitted|operationalAvailable)\)/g)||[]).length>=3)
check('Formula original preservada',
  s.includes('() => totalAccountsBalance - operationalCommitted'))
check('Compromissos apenas imediatos',
  s.includes("e.direction === 'expense' && e.date <= todayIso"))
check('Inbox V204 preservada',s.includes('homeInboxSummary('))
check('Sincronizacao preservada',s.includes('reconcileBalance'))
check('Contexto preservado',s.includes('effectiveContext'))
check('Navegacao contas preservada',s.includes("router.push('/accounts')"))
check('Gate Android V205',flow.includes('node scripts/check-v205-operational-detail.mjs'))
console.log(`V205: ${n} contratos aprovados.`)
