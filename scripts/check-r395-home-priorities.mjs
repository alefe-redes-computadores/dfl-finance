import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const file='src/app/(app)/home/page.tsx'
const s=fs.readFileSync(file,'utf8')

const checks=[
  ['Resumo inicial limitado a tres',
    s.includes('homePriorityAlerts.slice(') &&
    s.includes('0,') && s.includes('3')],
  ['Expansao manual',
    s.includes('setShowAllHomePriorities(current => !current)')],
  ['Lista completa disponivel',
    s.includes('showAllHomePriorities') &&
    s.includes('? homePriorityAlerts')],
  ['Apenas itens exibidos renderizados',
    s.includes('displayedPriorityAlerts.map((alert, index)')],
  ['Controle acessivel',
    s.includes('aria-expanded={showAllHomePriorities}')],
  ['Identificador de lista',
    s.includes('id="home-priorities-list"')],
  ['Pode recolher',
    s.includes('Recolher prioridades')],
  ['Contagem de ocultos preservada',
    s.includes('hiddenPriorityAlertsCount')],
  ['Inbox preservada',
    s.includes('homeInboxSummary')],
  ['Disponivel operacional preservado',
    s.includes('homeOperationalInsight')],
  ['Regra de pendencias preservada',
    s.includes('belongsInFinancialInbox')],
]

for(const [label,pass] of checks){
  assert.ok(pass,label)
  console.log('OK:',label)
}

const ast=ts.createSourceFile(
  file,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)
assert.equal(ast.parseDiagnostics.length,0)

console.log('R395: contratos de Home aprovados')
