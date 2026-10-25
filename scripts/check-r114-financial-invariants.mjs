import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { createRequire } from 'node:module'

const nativeRequire = createRequire(import.meta.url)
let passed = 0

function check(name, fn) {
  fn()
  passed++
  console.log('✓', name)
}

function loadTs(path, mocks = {}) {
  const source = fs.readFileSync(path, 'utf8')
  const parsed = ts.createSourceFile(
    path, source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.TS
  )
  assert.equal(
    parsed.parseDiagnostics.length, 0,
    `Erro de sintaxe em ${path}`
  )

  const js = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText

  const exports = {}
  const requireFn = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.startsWith('@/')) {
      throw new Error(`Dependência não simulada: ${name}`)
    }
    return nativeRequire(name)
  }

  new Function('require', 'exports', js)(
    requireFn, exports
  )
  return exports
}

const validDate = value => {
  if (typeof value !== 'string') return null
  const d = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const parsed = new Date(`${d}T12:00:00Z`)
  return parsed.toISOString().slice(0,10) === d ? d : null
}

const forecastMock = {
  civilDate: validDate,
  civilISO: () => '2026-10-25'
}

const inbox = loadTs('src/lib/inboxPolicy.ts', {
  '@/lib/financialForecast': forecastMock
})

const reviewRow = {
  id: 'review-1',
  type: 'expense',
  status: 'pending',
  source: 'whatsapp',
  date: '2026-11-10',
  amount: 20,
  affects_balance: false
}

check('Importação automatizada exige revisão', () => {
  assert.equal(inbox.needsFinancialReview(reviewRow), true)
})

check('Revisão permanece visível mesmo com data futura', () => {
  assert.equal(
    inbox.belongsInFinancialInbox(reviewRow, '2026-10-25'),
    true
  )
  assert.equal(
    inbox.inboxState(reviewRow, '2026-10-25').future,
    true
  )
})

check('Despesa futura manual não vira pendência imediata', () => {
  const row = {
    ...reviewRow, source: 'manual'
  }
  assert.equal(
    inbox.belongsInFinancialInbox(row, '2026-10-25'),
    false
  )
})

check('Despesa vencida continua pendente', () => {
  const row = {
    ...reviewRow,
    source: 'manual',
    date: '2026-10-20'
  }
  assert.equal(
    inbox.belongsInFinancialInbox(row, '2026-10-25'),
    true
  )
  assert.equal(
    inbox.inboxState(row, '2026-10-25').overdue,
    true
  )
})

check('Transferência não entra na conciliação comum', () => {
  assert.equal(inbox.isInboxCandidate({
    ...reviewRow,
    type: 'transfer'
  }), false)
})

check('Fatura de cartão não entra na conciliação comum', () => {
  assert.equal(inbox.isInboxCandidate({
    ...reviewRow,
    credit_card_id: 'card-1'
  }), false)
})

check('Importação concluída deixa de exigir revisão após aprovação', () => {
  assert.equal(inbox.needsFinancialReview({
    ...reviewRow, reviewed_at: '2026-10-25T12:00:00Z'
  }), false)
})

const transfer = loadTs(
  'src/lib/transferMovementOperations.ts',
  {
    '@/lib/db': {db: {}, addToSyncQueue: () => {}},
    '@/lib/financialRevision': {
      transactionRevisionSignature: () => 'signature'
    },
    '@/lib/financialForecast': forecastMock
  }
)

const outgoing = {
  id: 'out-1',
  user_id: 'person-1',
  transfer_group_id: 'group-1',
  transfer_direction: 'out',
  type: 'transfer',
  status: 'done',
  amount: 140.25,
  account_id: 'account-a',
  to_account_id: 'account-b'
}

const incoming = {
  ...outgoing,
  id: 'in-1',
  transfer_direction: 'in',
  account_id: 'account-b',
  to_account_id: 'account-a'
}

check('Transferência íntegra possui duas pernas', () => {
  const pair = transfer.resolveTransferPair([
    incoming, outgoing
  ])
  assert.equal(pair.outgoing.id, 'out-1')
  assert.equal(pair.incoming.id, 'in-1')
})

check('Transferência não aceita perna ausente', () => {
  assert.throws(
    () => transfer.resolveTransferPair([outgoing])
  )
})

check('Transferência não aceita valores divergentes', () => {
  assert.throws(
    () => transfer.resolveTransferPair([
      outgoing, {...incoming, amount: 150}
    ])
  )
})

check('Transferência não aceita usuários diferentes', () => {
  assert.throws(
    () => transfer.resolveTransferPair([
      outgoing, {...incoming, user_id: 'person-2'}
    ])
  )
})

check('Transferência não aceita mesma conta nas duas pernas', () => {
  assert.throws(
    () => transfer.resolveTransferPair([
      outgoing, {...incoming, account_id: 'account-a'}
    ])
  )
})

check('Transferência não aceita grupo divergente', () => {
  assert.throws(
    () => transfer.resolveTransferPair([
      outgoing, {...incoming, transfer_group_id: 'group-2'}
    ])
  )
})

check('Transferência não aceita terceira perna', () => {
  assert.throws(
    () => transfer.resolveTransferPair([
      outgoing, incoming, {...incoming, id: 'third'}
    ])
  )
})

check('Transferência não aceita direção ambígua', () => {
  assert.throws(
    () => transfer.resolveTransferPair([
      outgoing, {...incoming, transfer_direction: 'out'}
    ])
  )
})

check('Transferência não aceita NaN', () => {
  assert.throws(
    () => transfer.resolveTransferPair([
      {...outgoing, amount: NaN},
      incoming
    ])
  )
})

const sync = loadTs(
  'src/lib/financialSyncContract.ts',
  {}
)

check('Identidade financeira repetida é determinística', () => {
  const a = sync.financialOperationId('operation:123')
  const b = sync.financialOperationId('operation:123')
  assert.equal(a, b)
})

check('Operações distintas recebem identidades distintas', () => {
  assert.notEqual(
    sync.financialOperationId('operation:123'),
    sync.financialOperationId('operation:124')
  )
})

check('Base sincronizada preserva revisão remota', () => {
  const base = sync.expectedSyncBase({
    sync_status: 'synced',
    updated_at: '2026-10-25T10:00:00Z'
  }, 'update')
  assert.equal(base.updated_at, '2026-10-25T10:00:00Z')
})

check('Base histórica desconhecida não é inventada', () => {
  const base = sync.expectedSyncBase({
    sync_status: 'pending',
    updated_at: '2026-10-25T10:00:00Z'
  }, 'update')
  assert.equal(base, undefined)
})

check('Criação nova tem base remota nula', () => {
  assert.deepEqual(
    sync.expectedSyncBase({}, 'create'),
    {updated_at: null}
  )
})

check('Receita concluída produz efeito positivo', () => {
  assert.equal(sync.transactionCashEffect({
    type: 'income',
    status: 'done',
    account_id: 'a',
    amount: 30
  }), 30)
})

check('Despesa concluída produz efeito negativo', () => {
  assert.equal(sync.transactionCashEffect({
    type: 'expense',
    status: 'done',
    account_id: 'a',
    amount: 30
  }), -30)
})

check('Transferência preserva soma de caixa', () => {
  const out = sync.transactionCashEffect(outgoing)
  const inc = sync.transactionCashEffect(incoming)
  assert.equal(out + inc, 0)
})

check('Transferência sem direção não é adivinhada', () => {
  assert.equal(sync.transactionCashEffect({
    ...outgoing,
    transfer_direction: undefined
  }), null)
})

check('Valor inválido não produz NaN no caixa', () => {
  assert.equal(sync.transactionCashEffect({
    type: 'income',
    status: 'done',
    account_id: 'a',
    amount: Number.NaN
  }), null)
})

console.log(
  `R114: ${passed} invariantes comportamentais aprovadas.`
)
