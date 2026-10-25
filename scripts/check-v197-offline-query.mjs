import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const n=read('src/components/NetworkStatus.tsx')
const q=read('src/hooks/useTransactionsList.ts')
const flow=read('.github/workflows/android-build.yml')
let total=0

function test(name,valid){
  assert.ok(valid,name)
  total++
  console.log('✓',name)
}

for(const p of [
  'src/components/NetworkStatus.tsx',
  'src/hooks/useTransactionsList.ts'
]){
  const ast=ts.createSourceFile(
    p,read(p),ts.ScriptTarget.Latest,true,
    p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS
  )
  test(`Sintaxe ${p}`,ast.parseDiagnostics.length===0)
}

test('Avisos distinguem ciclos',n.includes('<NetworkNoticeBanner key={notice.key} notice={notice} />'))
test('Estado anterior rastreado',n.includes('const [dismissed, setDismissed] = useState(false)'))
test('Dispensa usa ciclo',n.includes('setDismissed(true)'))
test('Aviso acessivel',n.includes('aria-live='))
test('Haptico preservado',n.includes('useHapticFeedback'))
test('Filtro de usuario protegido',read("src/lib/transactionListPolicy.ts").includes("key !== 'user_id'"))
test('Filtros em uma passagem',q.includes('transactionMatchesFilters('))
test('Indice de contexto preservado',q.includes('[user_id+context]'))
test('Indice de data preservado',q.includes('[user_id+date]'))
test('Indice composto preservado',q.includes('[user_id+context+date]'))
test('Ordenacao preservada',q.includes('dateCompare'))
test('Dados estaveis preservados',q.includes('stableLocalRows(data)'))
test('Pipeline atualizado',flow.includes('node scripts/check-v197-offline-query.mjs'))

console.log(`V197: ${total} contratos aprovados.`)
