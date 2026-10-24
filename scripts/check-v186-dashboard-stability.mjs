import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const file = 'src/hooks/useDashboardMetrics.ts'
const source = fs.readFileSync(file, 'utf8')
const workflow = fs.readFileSync(
  '.github/workflows/android-build.yml', 'utf8'
)

let total = 0

function check(label, fn) {
  fn()
  total++
  console.log('✓', label)
}

check('Sintaxe TypeScript valida', () => {
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  assert.equal(parsed.parseDiagnostics.length, 0)
})

check('Chave usa ano e mes', () => {
  assert.ok(source.includes('currentDate.getFullYear()'))
  assert.ok(source.includes('currentDate.getMonth() + 1'))
})

check('Referencia mensal memoizada', () => {
  assert.ok(source.includes('const referenceDate = useMemo('))
  assert.ok(source.includes('[monthKey]'))
})

check('Recalculo depende da referencia mensal', () => {
  assert.ok(source.includes(
    '[context, referenceDate, user?.id]'
  ))
})

check('Controle de versao por consulta', () => {
  assert.ok(source.includes(
    '++requestVersionRef.current'
  ))
})

check('Consulta invalida ignora resultado', () => {
  assert.ok(source.includes(
    'requestVersion === requestVersionRef.current'
  ))
})

check('Resultados antigos nao publicam metricas', () => {
  assert.ok(source.includes(
    'if (!isCurrentRequest()) return'
  ))
})

check('Erro antigo nao apaga metricas atuais', () => {
  assert.ok(source.includes(
    'if (isCurrentRequest()) {\n        setMetrics(null)'
  ))
})

check('Loading antigo nao altera carregamento recente', () => {
  assert.ok(source.includes(
    'if (isCurrentRequest()) {\n        setLoading(false)'
  ))
})

check('Cleanup invalida consultas antigas', () => {
  assert.ok(source.includes(
    'requestVersionRef.current += 1'
  ))
})

check('Reload manual permanece disponivel', () => {
  assert.ok(source.includes('reload: calculateMetrics'))
})

check('Consulta continua isolada pelo usuario', () => {
  assert.ok(source.includes('user.id'))
  assert.ok(source.includes("where('user_id')"))
})

check('Janela indexada de transacoes preservada', () => {
  assert.ok(source.includes("where('[user_id+date]')"))
})

check('Separacao PF e PJ preservada', () => {
  assert.ok(source.includes("'personal'"))
  assert.ok(source.includes("'dfl'"))
})

check('Receitas e despesas usam motor existente', () => {
  assert.ok(source.includes('sumIncome(pfTransactions)'))
  assert.ok(source.includes('sumExpense(pjTransactions)'))
})

check('Distribuicao de categorias preservada', () => {
  assert.ok(source.includes('buildCategoryDistribution('))
})

check('Projecao mensal preservada', () => {
  assert.ok(source.includes('buildMonthlyProjection({'))
})

check('Projecao diaria preservada', () => {
  assert.ok(source.includes('buildDailyProjection({'))
})

check('Saldo continua consultado nas contas locais', () => {
  assert.ok(source.includes('getContextBalance('))
})

check('Nenhuma escrita financeira acrescentada', () => {
  assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.rpc\(/.test(source))
})

check('Android exige V186', () => {
  assert.ok(workflow.includes(
    'node scripts/check-v186-dashboard-stability.mjs'
  ))
})

console.log(`V186: ${total} contratos aprovados.`)
