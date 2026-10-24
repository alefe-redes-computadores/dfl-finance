import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')

const paths = [
  'src/lib/localQueryPolicy.ts',
  'src/hooks/useLocalData.ts',
  'src/hooks/useTransactionsList.ts',
  'src/hooks/useDebtsList.ts'
]

let count = 0
function check(title, fn) {
  fn()
  count++
  console.log('✓', title)
}

for (const path of paths) {
  check(`Sintaxe TS: ${path}`, () => {
    const source = ts.createSourceFile(
      path, read(path),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.TS
    )
    assert.equal(source.parseDiagnostics.length, 0)
  })
}

const exports = {}
new Function('exports', ts.transpileModule(read(paths[0]), {
  fileName: paths[0],
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText)(exports)

const stable = exports.stableLocalRows
const signature = exports.localFilterSignature

check('Vazio tem identidade estável', () => {
  assert.strictEqual(stable(undefined), stable(undefined))
})

check('Vazio está protegido contra mutação', () => {
  assert.ok(Object.isFrozen(stable(undefined)))
})

check('Array fornecido mantém a identidade', () => {
  const values = [{ id: 'a' }]
  assert.strictEqual(stable(values), values)
})

check('Array vazio fornecido não é substituído', () => {
  const empty = []
  assert.strictEqual(stable(empty), empty)
})

check('Filtros iguais têm assinatura igual', () => {
  assert.equal(
    signature({ context: 'personal', status: 'done' }),
    signature({ status: 'done', context: 'personal' })
  )
})

check('Filtros distintos não colidem', () => {
  assert.notEqual(
    signature({ context: 'personal' }),
    signature({ context: 'dfl' })
  )
})

check('Filtros preservam zero e false', () => {
  assert.notEqual(signature({ value: 0 }), signature({}))
  assert.notEqual(signature({ active: false }), signature({}))
})

check('Filtros ignoram undefined como JSON legado', () => {
  assert.equal(
    signature({ context: 'dfl', ignored: undefined }),
    signature({ context: 'dfl' })
  )
})

check('Ordem interna dos objetos não altera assinatura', () => {
  assert.equal(
    signature({ extra: { b: 2, a: 1 } }),
    signature({ extra: { a: 1, b: 2 } })
  )
})

check('Ordem de arrays permanece significativa', () => {
  assert.notEqual(
    signature({ ids: ['a', 'b'] }),
    signature({ ids: ['b', 'a'] })
  )
})

check('Valores null continuam distintos de ausentes', () => {
  assert.notEqual(signature({ category: null }), signature({}))
})

check('Hooks compartilham identidade estável', () => {
  for (const path of paths.slice(1)) {
    assert.ok(read(path).includes('stableLocalRows(data)'))
  }
})

check('Filtros são estáveis nos dois hooks', () => {
  assert.ok(read(paths[1]).includes('localFilterSignature(filters)'))
  assert.ok(read(paths[2]).includes('localFilterSignature(filters)'))
})

check('useLocalData mantém isolamento do usuário', () => {
  const source = read(paths[1])
  assert.ok(source.includes("key !== 'user_id'"))
  assert.ok(source.includes('user.id'))
})

check('Índices financeiros preservados', () => {
  const source = read(paths[1])
  assert.ok(source.includes('[user_id+context]'))
  assert.ok(source.includes('[user_id+credit_card_id]'))
  assert.ok(source.includes('[user_id+account_id]'))
})

check('Transações preservam índices por período', () => {
  const source = read(paths[2])
  assert.ok(source.includes('[user_id+context+date]'))
  assert.ok(source.includes('[user_id+date]'))
})

check('Transações continuam ordenadas por data', () => {
  const source = read(paths[2])
  assert.ok(source.includes('return items.sort('))
  assert.ok(source.includes('created_at'))
})

check('Dívidas continuam isoladas por usuário', () => {
  const source = read(paths[3])
  assert.ok(source.includes("where('user_id')"))
  assert.ok(source.includes('equals(user.id)'))
})

check('Sem operações de escrita financeira', () => {
  for (const source of paths.map(read)) {
    assert.ok(!/\.insert\(|\.update\(|\.delete\(|\.rpc\(/.test(source))
  }
})

check('Pipeline Android exige V185', () => {
  assert.ok(read('.github/workflows/android-build.yml')
    .includes('node scripts/check-v185-local-query-performance.mjs'))
})

console.log(`V185: ${count} contratos aprovados.`)
