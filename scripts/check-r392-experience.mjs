import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const files={
  agenda:'src/app/(app)/agenda/page.tsx',
  planning:'src/app/(app)/planning/page.tsx',
  reports:'src/app/(app)/reports/page.tsx'
}

const read=p=>fs.readFileSync(p,'utf8')
const agenda=read(files.agenda)
const planning=read(files.planning)
const reports=read(files.reports)

const checks=[
  ['Agenda limita grupos renderizados',
    agenda.includes('visibleGroups.slice(0,visibleGroupLimit)')],
  ['Agenda preserva grupo por data',
    agenda.includes('renderedGroups.map(([date,items])=>')],
  ['Agenda permite carregar mais',
    agenda.includes('setVisibleGroupLimit(current=>current+10)')],
  ['Agenda reseta ao mudar filtros',
    agenda.includes('[days,filter,term,selectedDate,effectiveContext]')],
  ['Agenda preserva consulta integral',
    agenda.includes('buildFinanceAgenda')],
  ['Agenda preserva pesquisa',
    agenda.includes('matchesFinancialSearch')],
  ['Agenda preserva contexto',
    agenda.includes('effectiveContext')],
  ['Planejamento preserva reservas',
    planning.includes('filterPlanningReserves')],
  ['Planejamento preserva limites',
    planning.includes('saveCap')],
  ['Planejamento preserva busca',
    planning.includes('normalizeFinancialSearch')],
  ['Relatorios preservam exportacao',
    reports.includes('exportStatus')],
  ['Relatorios preservam filtros',
    reports.includes('setFilterType')],
  ['Relatorios possuem retorno acessivel',
    reports.includes('Voltar para a página anterior')]
]

for(const [name,ok] of checks){
  assert.ok(ok,name);
  console.log('OK:',name);
}

for(const path of Object.values(files)){
  const ast=ts.createSourceFile(
    path,read(path),ts.ScriptTarget.Latest,true,
    ts.ScriptKind.TSX
  );

  assert.equal(ast.parseDiagnostics.length,0,
    'Erro JSX: '+path);
}

console.log('R392: contratos aprovados')
