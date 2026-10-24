import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path='src/app/(app)/transactions/page.tsx'
const s=fs.readFileSync(path,'utf8')
const flow=fs.readFileSync('.github/workflows/android-build.yml','utf8')
let n=0
function check(name,ok){
  assert.ok(ok,name)
  n++
  console.log('✓',name)
}

const parsed=ts.createSourceFile(
  path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
)

check('TSX válido',parsed.parseDiagnostics.length===0)
check('Memo instalado',s.includes('React.memo(TransactionItem)'))
check('Sem comparação somente por ID',!s.includes('React.memo(TransactionItem,'))
check('Dois locais atualizados',s.split('<MemoTransactionItem').length-1===2)
check('Dados completos preservados',s.includes('transaction={tx}')&&s.includes('transaction={t}'))
check('Valores preservados',s.includes('safeNum(transaction.amount)'))
check('Transferências preservadas',s.includes('transaction._transferView'))
check('Status preservado',s.includes("transaction.status === 'pending'"))
check('Ícones preservados',s.includes('getDynamicIcon(transaction.categories?.icon)'))
check('Navegação preservada',s.includes('/transactions/details?id=${transaction.id}'))
check('Busca V188 preservada',s.includes('useDeferredValue(search)'))
check('Grupos V189 preservados',s.includes('const grouped = useMemo('))
check('Pendências V190 preservadas',s.includes('const pendingSummaryTxs = useMemo('))
check('Totais V191 preservados',s.includes('const pendingTotals = useMemo('))
check('Android exige V192',flow.includes('node scripts/check-v192-transaction-cards.mjs'))

console.log(`V192: ${n} contratos aprovados.`)
