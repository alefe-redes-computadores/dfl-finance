import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read = name => fs.readFileSync(name,'utf8')
const path = p => `src/app/(app)/${p}/new/page.tsx`
const debts=read(path('debts'))
const loans=read(path('loans'))
const financing=read(path('financings'))
const goals=read(path('goals'))
const budgets=read(path('budgets'))
const cases=[
  ['Quem me deve usa identidade de categoria',debts.includes('<SelectedCategoryIcon size={20} />')],
  ['Quem me deve usa logo real da conta selecionada',debts.includes('<BankLogo name={selectedAcc.bank || selectedAcc.name}')],
  ['Quem me deve mostra logos no seletor de contas',debts.includes('<BankLogo name={acc.bank || acc.name}')],
  ['Quem me deve usa calendário premium',debts.includes('title="Vencimento do valor a receber"')],
  ['Quem me deve permite remover vencimento',debts.includes('aria-label="Remover vencimento"')],
  ['Quem me deve sem escala que invade o rótulo',!debts.includes('scale-125 ring-2') && debts.includes('aria-pressed={color === c}')],
  ['Empréstimos usa dois calendários premium',loans.includes('title="Data do empréstimo"')&&loans.includes('title="Vencimento do empréstimo"')],
  ['Financiamentos usa dois calendários premium',financing.includes('title="Início do financiamento"')&&financing.includes('title="Primeiro vencimento"')],
  ['Meta usa calendário premium',goals.includes('title="Data limite da meta"')],
  ['Meta permite remover data limite',goals.includes('aria-label="Remover data limite"')],
  ['Meta usa identidade da categoria',goals.includes('<SelectedCategoryIcon size={20} />')],
  ['Meta não amplia cores além dos limites',!goals.includes("scale-110 ring-2 ring-gray-400")&&goals.includes('aria-pressed={color === c}')],
  ['Orçamento mostra ícone da categoria',budgets.includes('const SelectedBudgetCategoryIcon = getDynamicIcon(selectedCat?.icon)')],
  ['Nenhuma data nativa nas quatro telas corrigidas',[debts,loans,financing,goals].every(s=>!s.includes('type="date"'))],
  ['Quem me deve preserva operações financeiras',debts.includes("await safeAdd('debts'")&&debts.includes("await safeUpdate('debts'")&&debts.includes('db.transactions')],
  ['Empréstimos preservam operações',loans.includes('safeAdd')&&loans.includes('safeUpdate')],
  ['Financiamentos preservam regras de contrato',financing.includes('syncFinancingSchedule')&&financing.includes('assertFinancingStructureEditable')],
]
for(const [label,passed] of cases){console.log(`${passed?'OK':'FALHA'}: ${label}`);assert.ok(passed,label)}
for(const file of [path('debts'),path('loans'),path('financings'),path('goals'),path('budgets')]){
  const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  assert.equal(source.parseDiagnostics.length,0,`Erro de sintaxe TSX em ${file}`)
}
console.log('V164: 17 contratos de experiência + 5 TSX aprovados')
