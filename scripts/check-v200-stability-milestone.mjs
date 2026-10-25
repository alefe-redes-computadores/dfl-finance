import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')
const source = path => {
  const exports = {}
  new Function(
    'exports',
    ts.transpileModule(read(path), {
      fileName: path,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020
      }
    }).outputText
  )(exports)
  return exports
}

const query = source('src/lib/transactionListPolicy.ts')
const local = source('src/lib/localQueryPolicy.ts')
const network = source('src/lib/networkNoticePolicy.ts')
const hook = read('src/hooks/useTransactionsList.ts')
const workflow = read('.github/workflows/android-build.yml')

let total = 0
function test(name, fn) {
  fn()
  total++
  console.log('✓', name)
}

const { invalidTransactionDateRange: invalid,
  transactionStableIdCompare: tie } = query
const { localFilterSignature: signature,
  stableLocalRows: rows } = local
const { getNetworkNotice: notice,
  shouldShowNetworkNotice: visible } = network

test('1000 intervalos mensais validos', () => {
  for (let i = 0; i < 1000; i++) {
    const m = String(i % 12 + 1).padStart(2, '0')
    const start = `2026-${m}-01`
    const end = `2026-${m}-28`
    assert.equal(invalid(start, end), false)
    assert.equal(invalid(end, start), true)
  }
})

test('Limites opcionais e mesmo dia', () => {
  assert.equal(invalid(null, null), false)
  assert.equal(invalid('2026-10-24', null), false)
  assert.equal(invalid(null, '2026-10-24'), false)
  assert.equal(invalid('2026-10-24', '2026-10-24'), false)
})

test('Desempate de IDs consistente e reversivel', () => {
  const ids = Array.from({ length: 150 }, (_, i) =>
    `tx-${String(i).padStart(4, '0')}`
  )
  const ordered = ids
    .map(id => ({ id }))
    .sort(tie)
    .map(v => v.id)

  assert.equal(new Set(ordered).size, ids.length)
  for (let i = 0; i < ordered.length - 1; i++) {
    assert.ok(tie({ id: ordered[i] }, { id: ordered[i+1] }) <= 0)
  }
  for (const id of ids) {
    assert.equal(tie({ id }, { id }), 0)
  }
})

test('Assinatura indiferente a ordem das propriedades', () => {
  for (let i = 0; i < 500; i++) {
    const a = { status: 'pending', amount: i, active: false }
    const b = { active: false, amount: i, status: 'pending' }
    assert.equal(signature(a), signature(b))
  }
})

test('Filtros diferentes nao colidem', () => {
  const signatures = new Set(
    Array.from({ length: 500 }, (_, i) =>
      signature({ amount: i, context: 'personal' })
    )
  )
  assert.equal(signatures.size, 500)
})

test('Zero, false e null permanecem distintos', () => {
  assert.notEqual(signature({ amount: 0 }), signature({}))
  assert.notEqual(signature({ active: false }), signature({}))
  assert.notEqual(signature({ status: null }), signature({}))
})

test('Identidade de resultados mantida', () => {
  const a = [{ id: '1', amount: 0 }]
  assert.strictEqual(rows(a), a)
  assert.strictEqual(rows(undefined), rows(undefined))
  assert.ok(Object.isFrozen(rows(undefined)))
})

test('Offline sempre prevalece', () => {
  for (let i = 0; i <= 100; i++) {
    const result = notice({
      isOnline: false,
      isSyncing: true,
      pendingCount: i
    })
    assert.equal(result.kind, 'offline')
    assert.equal(result.pendingCount, i)
  }
})

test('Estados online sao distinguiveis', () => {
  assert.equal(notice({ isOnline: true, pendingCount: 0 }), null)
  assert.equal(notice({
    isOnline: true, pendingCount: 3
  }).kind, 'pending')
  assert.equal(notice({
    isOnline: true, pendingCount: 3, isSyncing: true
  }).kind, 'syncing')
})

test('Dispensa nao confirma sincronizacao', () => {
  const pending = notice({ isOnline: true, pendingCount: 3 })
  const offline = notice({ isOnline: false, pendingCount: 3 })
  assert.equal(visible(pending, pending.key), false)
  assert.equal(visible(offline, pending.key), true)
  assert.equal(notice({ isOnline: true, pendingCount: 0 }), null)
})

test('Consultas seguem isoladas por usuario', () => {
  assert.ok(hook.includes("key !== 'user_id'"))
  assert.ok(hook.includes('.equals(user.id)'))
  assert.ok(hook.includes('activeFilters.every('))
})

test('Indices e ordenacao financeira preservados', () => {
  for (const key of [
    '[user_id+context+date]',
    '[user_id+date]',
    '[user_id+context]',
    'dateCompare',
    'createdCompare',
    'transactionStableIdCompare(a, b)'
  ]) assert.ok(hook.includes(key), key)
})

test('Consulta sem escrita ou chamadas remotas', () => {
  assert.ok(!/fetch\(|\.put\(|\.delete\(|\.update\(|\.rpc\(/.test(hook))
})

test('Workflow mantem auditorias V196 a V200', () => {
  for (const version of [196,197,198,199,200]) {
    assert.ok(workflow.includes(`node scripts/check-v${version}-`))
  }
})

console.log(`V200: ${total} cenarios funcionais aprovados.`)
