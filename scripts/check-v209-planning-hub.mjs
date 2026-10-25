import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const path='src/app/(app)/planning/page.tsx'
const s=read(path)
const flow=read('.github/workflows/android-build.yml')
let n=0
function test(label,condition){
  assert.ok(condition,label)
  console.log('✓',label)
  n++
}

const ast=ts.createSourceFile(path,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
test('TSX valido',ast.parseDiagnostics.length===0)
test('Navegacao Home',s.includes("path: '/home'"))
test('Navegacao Transacoes',s.includes("path: '/transactions'"))
test('Navegacao Inbox',s.includes("path: '/conciliation'"))
test('Navegacao depende de clique',s.includes('onClick={() => router.push(item.path)}'))
test('Rotas sem efeito automatico',!s.includes('useEffect(()=>router.push(item.path)'))
test('Diferenca realizado planejado',s.includes('Do realizado ao planejado'))
test('Reservas nao simulam transferencias',s.includes('Reservas declaradas não representam transferências automáticas'))
test('Carregamento acessivel',s.includes('aria-live="polite"'))
test('Contexto ativo indicado',s.includes("context === 'dfl' ? 'DFL' : 'Pessoal'"))
test('Radar preservado',s.includes("router.push('/cash-pressure')"))
test('Salvamento de reservas preservado',s.includes('const saveReserve=async'))
test('Remocao de reservas preservada',s.includes('const removeReserve=async'))
test('Limite flexivel preservado',s.includes('const saveCap=async'))
test('Categorias preservadas',s.includes('const saveBucket=async'))
test('Motor de planejamento original',s.includes('buildFinancePlanning('))
test('Sem gravacao de ledger adicionada',!s.includes('db.transactions.put('))
test('Gate Android V209',flow.includes('node scripts/check-v209-planning-hub.mjs'))
console.log(`V209: ${n} contratos aprovados.`)
