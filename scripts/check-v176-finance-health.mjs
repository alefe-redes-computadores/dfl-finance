import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const files = [
  'src/lib/financeHealth.ts',
  'src/app/(app)/financial-health/page.tsx'
]

let passed = 0
const check = (name, fn) => {
  fn()
  passed++
  console.log('✓', name)
}

for (const path of files) {
  check(`Sintaxe ${path}`, () => {
    const source = fs.readFileSync(path, 'utf8')
    const parsed = ts.createSourceFile(
      path, source, ts.ScriptTarget.Latest, true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    assert.equal(parsed.parseDiagnostics.length, 0)
  })
}

const source = fs.readFileSync(files[0], 'utf8')
const page = fs.readFileSync(files[1], 'utf8')
const more = fs.readFileSync('src/app/(app)/more/page.tsx', 'utf8')

check('Motor deriva do fechamento V175', () => {
  assert.ok(source.includes('buildMonthlyReview('))
})
check('Motor não escreve banco', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|safeAdd|safeUpdate|supabase\./.test(source))
})
check('Tela não altera ledger', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|safeAdd|safeUpdate/.test(page))
})
check('Contexto da aplicação preservado', () => {
  assert.ok(page.includes('effectiveContext'))
  assert.ok(page.includes('<ContextToggle/>'))
})
check('Motor tem sinal de dados insuficientes', () => {
  assert.ok(source.includes("id: 'absence'"))
})
check('Motor não calcula score artificial', () => {
  assert.ok(!/financialScore|healthScore|score\s*=/.test(source))
})
check('Motor apresenta limitações', () => {
  assert.ok(source.includes('limitations.push('))
})
check('Motor preserva comparação proporcional', () => {
  assert.ok(source.includes('expenseVariation'))
})
check('Motor diferencia receita recebida', () => {
  assert.ok(source.includes('monthly.income'))
})
check('Motor não utiliza fatura como nova despesa', () => {
  assert.ok(source.includes('monthly.expense'))
})
check('Sinais têm evidências e prioridade', () => {
  assert.ok(source.includes('evidence:'))
  assert.ok(source.includes('priority:'))
})
check('Sinais mostram ausência de base comparável', () => {
  assert.ok(source.includes("id: 'trend'"))
  assert.ok(source.includes('Sem base'))
})
check('Sinais identificam lançamentos incompletos', () => {
  assert.ok(source.includes('missingCategories'))
  assert.ok(source.includes('missingAccounts'))
})
check('Sinais identificam pendências', () => {
  assert.ok(source.includes('monthly.pendingCount'))
})
check('Sinais identificam concentração por categoria', () => {
  assert.ok(source.includes('categoryShare >= 50'))
})
check('Acesso pelo menu Mais', () => {
  assert.equal((more.match(/href="\/financial-health"/g) || []).length, 1)
})
check('Atalho para revisão mensal', () => {
  assert.ok(page.includes("'/monthly-review'"))
})
check('Atalho para conciliação', () => {
  assert.ok(page.includes("'/conciliation'"))
})
check('Atalho para planejamento', () => {
  assert.ok(page.includes("'/planning'"))
})
check('Atalho para Radar', () => {
  assert.ok(page.includes("'/cash-pressure'"))
})
check('Contrato V175 continua disponível', () => {
  assert.ok(fs.existsSync('scripts/check-v175-monthly-review.mjs'))
})
check('Contrato V174 continua disponível', () => {
  assert.ok(fs.existsSync('scripts/check-v174-finance-pressure.mjs'))
})

console.log(`V176: ${passed} verificações estruturais aprovadas.`)
