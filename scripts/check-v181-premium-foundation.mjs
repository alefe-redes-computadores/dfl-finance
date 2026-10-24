import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')

let count = 0

function check(name, fn) {
  fn()
  count++
  console.log('✓', name)
}

const files = [
  'src/lib/toastQueuePolicy.ts',
  'src/contexts/ToastContext.tsx',
  'src/components/Toast.tsx',
  'src/components/EmptyState.tsx',
  'src/components/Skeleton.tsx'
]

for (const path of files) {
  check(`Sintaxe: ${path}`, () => {
    const f = ts.createSourceFile(
      path,
      read(path),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    assert.equal(f.parseDiagnostics.length, 0)
  })
}

const source = read(files[0])
const exports = {}

new Function(
  'exports',
  ts.transpileModule(source, {
    fileName: files[0],
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText
)(exports)

const {
  enqueueFinanceToast: add,
  normalizeToastMessage: normalize
} = exports

const item = (id, message, type) => ({
  id, message, type
})

check('Normaliza mensagens', () => {
  assert.equal(
    normalize('  Aviso \n importante  '),
    'Aviso importante'
  )
})

check('Ignora mensagem vazia', () => {
  assert.deepEqual(
    add([], item('a', '   ', 'info')),
    []
  )
})

check('Adiciona avisos', () => {
  assert.equal(
    add([], item('a', 'Salvo', 'success')).length,
    1
  )
})

check('Deduplica mensagens', () => {
  let q = add([], item('a', 'Salvo', 'success'))
  q = add(q, item('b', 'Salvo', 'success'))

  assert.equal(q.length, 1)
  assert.equal(q[0].id, 'b')
})

check('Distingue tipos', () => {
  let q = add([], item('a', 'Revisar', 'info'))
  q = add(q, item('b', 'Revisar', 'error'))
  assert.equal(q.length, 2)
})

check('Limita tres toasts', () => {
  let q = []

  for (let i = 0; i < 20; i++) {
    q = add(q, item(`${i}`, `Mensagem ${i}`, 'info'))
  }

  assert.equal(q.length, 3)
})

check('Preserva erro importante', () => {
  let q = [
    item('a', 'Erro importante', 'error'),
    item('b', 'Ok 1', 'success'),
    item('c', 'Ok 2', 'success')
  ]

  q = add(q, item('d', 'Ok 3', 'success'))
  assert.ok(q.some(x => x.id === 'a'))
})

check('Preserva erros contra informativos', () => {
  let q = [
    item('a', 'Erro A', 'error'),
    item('b', 'Erro B', 'error'),
    item('c', 'Aviso C', 'warning')
  ]

  q = add(q, item('d', 'Info', 'info'))
  assert.deepEqual(q.map(x => x.id), ['a', 'b', 'c'])
})

check('Fila cheia aceita novo erro', () => {
  let q = [
    item('a', 'Erro A', 'error'),
    item('b', 'Erro B', 'error'),
    item('c', 'Erro C', 'error')
  ]

  q = add(q, item('d', 'Erro D', 'error'))
  assert.deepEqual(q.map(x => x.id), ['b', 'c', 'd'])
})

check('Nao modifica array original', () => {
  const original = [item('a', 'Primeiro', 'warning')]
  const before = JSON.stringify(original)

  add(original, item('b', 'Segundo', 'success'))

  assert.equal(JSON.stringify(original), before)
})

check('Provider utiliza nova politica', () => {
  assert.ok(
    read(files[1]).includes('enqueueFinanceToast(current')
  )
})

check('Toast preserva acessibilidade', () => {
  const s = read(files[2])
  assert.ok(s.includes('aria-label="Fechar aviso"'))
  assert.ok(s.includes('h-11 w-11'))
  assert.ok(s.includes("'assertive'"))
})

check('Toast preserva pausa de leitura', () => {
  assert.ok(
    read(files[2]).includes('onFocusCapture={pauseLifetime}')
  )
})

check('EmptyState usa haptic opcional', () => {
  const s = read(files[3])
  assert.ok(s.includes('useHapticFeedback'))
  assert.ok(s.includes('if (!onAction) return'))
  assert.ok(s.includes('light()'))
})

check('EmptyState preserva API', () => {
  const s = read(files[3])
  for (const field of [
    'actionLabel?',
    'onAction?',
    'title:',
    'message:',
    'icon:'
  ]) {
    assert.ok(s.includes(field))
  }
})

check('Skeleton limita DOM', () => {
  assert.ok(
    read(files[4]).includes('Math.min(24, Math.floor(count))')
  )
})

check('Skeleton preserva movimento reduzido', () => {
  assert.ok(
    read(files[4]).includes('motion-reduce:animate-none')
  )
})

check('Nenhum componente acessa ledger', () => {
  for (const path of files) {
    assert.ok(
      !/supabase\.from|db\.transactions|db\.accounts|processSyncQueue/.test(read(path))
    )
  }
})

check('Workflow exige V181', () => {
  assert.ok(
    read('.github/workflows/android-build.yml')
      .includes('node scripts/check-v181-premium-foundation.mjs')
  )
})

console.log(`V181: ${count} contratos aprovados.`)
