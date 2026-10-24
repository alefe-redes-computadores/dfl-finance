import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const policyFile = 'src/lib/toastQueuePolicy.ts'
const source = fs.readFileSync(policyFile, 'utf8')
const workflow = fs.readFileSync(
  '.github/workflows/android-build.yml',
  'utf8'
)

let total = 0
function check(name, fn) {
  fn()
  total++
  console.log('✓', name)
}

check('Politica tem sintaxe TypeScript valida', () => {
  const parsed = ts.createSourceFile(
    policyFile,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  assert.equal(parsed.parseDiagnostics.length, 0)
})

const exports = {}
new Function('exports', ts.transpileModule(source, {
  fileName: policyFile,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText)(exports)

const add = exports.enqueueFinanceToast
const normalize = exports.normalizeToastMessage
const item = (id, message, type) => ({ id, message, type })

check('Normalizacao preservada', () => {
  assert.equal(normalize('  Aviso \n novo  '), 'Aviso novo')
})

check('Fila vazia nao aceita espacos', () => {
  const initial = []
  assert.strictEqual(add(initial, item('x', '   ', 'info')), initial)
})

check('Mensagens validas entram na fila', () => {
  assert.equal(
    add([], item('a', 'Operacao confirmada', 'success')).length,
    1
  )
})

check('Duplicidade substitui aviso anterior', () => {
  let q = add([], item('a', 'Salvo', 'success'))
  q = add(q, item('b', 'Salvo', 'success'))
  assert.deepEqual(q.map(x => x.id), ['b'])
})

check('Tipos distintos nao se anulam', () => {
  let q = add([], item('a', 'Revisar', 'warning'))
  q = add(q, item('b', 'Revisar', 'error'))
  assert.equal(q.length, 2)
})

check('Fila limitada a tres elementos', () => {
  let q = []
  for (let i = 0; i < 15; i++) {
    q = add(q, item(String(i), `Aviso ${i}`, 'info'))
  }
  assert.equal(q.length, 3)
})

check('Informativo rejeitado preserva a mesma referencia', () => {
  const current = [
    item('a', 'Erro A', 'error'),
    item('b', 'Erro B', 'error'),
    item('c', 'Aviso C', 'warning')
  ]
  const result = add(current, item('d', 'Info nova', 'info'))
  assert.strictEqual(result, current)
})

check('Sucesso rejeitado preserva a mesma referencia', () => {
  const current = [
    item('a', 'Erro A', 'error'),
    item('b', 'Erro B', 'error'),
    item('c', 'Aviso C', 'warning')
  ]
  const result = add(current, item('d', 'Tudo bem', 'success'))
  assert.strictEqual(result, current)
})

check('Erro novo entra mesmo com fila critica cheia', () => {
  const current = [
    item('a', 'Erro A', 'error'),
    item('b', 'Erro B', 'error'),
    item('c', 'Erro C', 'error')
  ]
  const result = add(current, item('d', 'Erro D', 'error'))
  assert.deepEqual(result.map(x => x.id), ['b', 'c', 'd'])
})

check('Erro novo substitui aviso informativo', () => {
  const current = [
    item('a', 'Erro A', 'error'),
    item('b', 'Sucesso', 'success'),
    item('c', 'Erro C', 'error')
  ]
  const result = add(current, item('d', 'Erro D', 'error'))
  assert.deepEqual(result.map(x => x.id), ['a', 'c', 'd'])
})

check('Aviso importante substitui sucesso', () => {
  const current = [
    item('a', 'Erro A', 'error'),
    item('b', 'Sucesso', 'success'),
    item('c', 'Erro C', 'error')
  ]
  const result = add(current, item('d', 'Atencao', 'warning'))
  assert.deepEqual(result.map(x => x.id), ['a', 'c', 'd'])
})

check('Nova mensagem nao altera objetos anteriores', () => {
  const current = [
    item('a', 'Mensagem A', 'error'),
    item('b', 'Mensagem B', 'warning')
  ]
  const snapshot = JSON.stringify(current)
  add(current, item('c', 'Mensagem C', 'info'))
  assert.equal(JSON.stringify(current), snapshot)
})

check('Mensagens informativas continuam funcionando', () => {
  const current = [
    item('a', 'Informacao A', 'info'),
    item('b', 'Informacao B', 'info'),
    item('c', 'Informacao C', 'info')
  ]
  const result = add(current, item('d', 'Informacao D', 'info'))
  assert.deepEqual(result.map(x => x.id), ['b', 'c', 'd'])
})

check('Provider continua usando politica compartilhada', () => {
  const provider = fs.readFileSync(
    'src/contexts/ToastContext.tsx', 'utf8'
  )
  assert.ok(provider.includes('enqueueFinanceToast(current'))
})

check('Toast continua com role acessivel', () => {
  const toast = fs.readFileSync(
    'src/components/Toast.tsx', 'utf8'
  )
  assert.ok(toast.includes("role={urgent ? 'alert' : 'status'}"))
})

check('Politica nao consulta dados financeiros', () => {
  assert.ok(!/supabase|db\.|fetch\(|processSyncQueue/.test(source))
})

check('Android exige V187', () => {
  assert.ok(workflow.includes(
    'node scripts/check-v187-toast-priority.mjs'
  ))
})

console.log(`V187: ${total} contratos aprovados.`)
