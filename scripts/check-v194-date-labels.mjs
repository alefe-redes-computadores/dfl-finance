import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path = 'src/app/(app)/transactions/page.tsx'
const s = fs.readFileSync(path, 'utf8')
const flow = fs.readFileSync(
  '.github/workflows/android-build.yml', 'utf8'
)

let count = 0
function check(label, condition) {
  assert.ok(condition, label)
  count++
  console.log('✓', label)
}

const parsed = ts.createSourceFile(
  path, s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
)

check('TSX valido', parsed.parseDiagnostics.length === 0)
check('Rotulos memoizados', s.includes('const dateLabels = useMemo('))
check('Map preserva correspondencia', s.includes("date === todayIso ? 'HOJE' : dateLabel(date)"))
check('Data atual invalida cache', s.includes('[sortedDates, todayIso]'))
check('Render usa cache', s.includes('dateLabels.get(date) ?? date'))
check('Rotulo HOJE preservado', s.includes("return 'HOJE'"))
check('Rotulo ONTEM preservado', s.includes("return 'ONTEM'"))
check('Data desconhecida preservada', s.includes("'Sem Data'"))
check('Grupos V189 preservados', s.includes('const grouped = useMemo('))
check('Pendencias V190 preservadas', s.includes('const pendingSummaryTxs = useMemo('))
check('Totais V191 preservados', s.includes('const pendingTotals = useMemo('))
check('Cards V192 preservados', s.includes('React.memo(TransactionItem)'))
check('Listas V193 preservadas', s.includes('const pendingCardDebts = useMemo('))
check('Busca V188 preservada', s.includes('useDeferredValue(search)'))
check('Transferencias preservadas', s.includes('transfer_group_id'))
check('Novo gate Android presente', flow.includes('node scripts/check-v194-date-labels.mjs'))

console.log(`V194: ${count} contratos aprovados.`)
