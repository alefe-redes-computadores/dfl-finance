import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const p='src/app/(app)/transactions/page.tsx'
const s=fs.readFileSync(p,'utf8')
const flow=fs.readFileSync('.github/workflows/android-build.yml','utf8')
let n=0
function check(label,valid){
  assert.ok(valid,label)
  n++
  console.log('✓',label)
}
const parsed=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
check('TSX valido',parsed.parseDiagnostics.length===0)
check('Pendentes memoizados',s.includes('const pendingTxs = useMemo('))
check('Dependencia da lista',s.includes('[filtered]'))
check('Cards de dividas memoizados',s.includes('const pendingCardDebts = useMemo('))
check('Dependencias completas',s.includes('[quickFilter, debtReceivablesForPeriod, debtSearchTerm]'))
check('Pesquisa preservada',s.includes('person.includes(debtSearchTerm)')||s.includes('.includes(debtSearchTerm)'))
check('Regras de filtro preservadas',s.includes("quickFilter === 'income'"))
check('Totais V191 preservados',s.includes('const pendingTotals = useMemo('))
check('Cards V192 preservados',s.includes('React.memo(TransactionItem)'))
check('Busca V188 preservada',s.includes('useDeferredValue(search)'))
check('Grupos V189 preservados',s.includes('const grouped = useMemo('))
check('Pendencias V190 preservadas',s.includes('const pendingSummaryTxs = useMemo('))
check('Filtro pendente preserva status',s.includes("tx.status === 'pending'"))
check('Filtro pendente depende de filtered',/const pendingTxs = useMemo\([\s\S]*?\[filtered\]/.test(s))
check('Resumo V190 continua usando filtro original',s.includes('transactionsWithJoin.filter('))
check('Ledger nao alterado nesta cirurgia',!s.includes('db.transactions.update(debtSearchTerm)'))
check('Android exige V193',flow.includes('node scripts/check-v193-list-memo.mjs'))
console.log(`V193: ${n} contratos aprovados.`)
