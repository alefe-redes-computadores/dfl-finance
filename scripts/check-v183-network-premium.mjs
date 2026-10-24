import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const policyFile = 'src/lib/networkNoticePolicy.ts'
const componentFile = 'src/components/NetworkStatus.tsx'
const workflowFile = '.github/workflows/android-build.yml'

const read = path => fs.readFileSync(path, 'utf8')
let count = 0

function check(label, fn) {
  fn()
  count++
  console.log('✓', label)
}

for (const path of [policyFile, componentFile]) {
  check(`TS parse: ${path}`, () => {
    const parsed = ts.createSourceFile(
      path,
      read(path),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    )
    assert.equal(parsed.parseDiagnostics.length, 0)
  })
}

const exports = {}
new Function(
  'exports',
  ts.transpileModule(read(policyFile), {
    fileName: policyFile,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText
)(exports)

const get = exports.getNetworkNotice
const visible = exports.shouldShowNetworkNotice

check('Online limpo nao inventa confirmacao', () => {
  assert.equal(get({
    isOnline: true, pendingCount: 0
  }), null)
})

check('Offline sem fila aparece', () => {
  assert.equal(get({
    isOnline: false, pendingCount: 0
  }).kind, 'offline')
})

check('Offline com fila preserva contador', () => {
  const x = get({
    isOnline: false, pendingCount: 4
  })
  assert.equal(x.kind, 'offline')
  assert.equal(x.pendingCount, 4)
  assert.ok(x.message.includes('preservada'))
})

check('Offline prevalece sobre sincronizando', () => {
  assert.equal(get({
    isOnline: false,
    isSyncing: true,
    pendingCount: 1
  }).kind, 'offline')
})

check('Sync online usa estado proprio', () => {
  assert.equal(get({
    isOnline: true,
    isSyncing: true,
    pendingCount: 3
  }).kind, 'syncing')
})

check('Pendente online nao aparece verde', () => {
  assert.equal(get({
    isOnline: true,
    isSyncing: false,
    pendingCount: 2
  }).kind, 'pending')
})

check('Contagem negativa normalizada', () => {
  assert.equal(get({
    isOnline: true, pendingCount: -5
  }), null)
})

check('Contagem infinita normalizada', () => {
  assert.equal(get({
    isOnline: true, pendingCount: Infinity
  }), null)
})

check('Contagem decimal normalizada', () => {
  assert.equal(get({
    isOnline: true, pendingCount: 2.7
  }).pendingCount, 2)
})

check('Dispensa o mesmo estado', () => {
  const x = get({
    isOnline: true, pendingCount: 3
  })
  assert.equal(visible(x, x.key), false)
})

check('Novo estado volta a aparecer', () => {
  const x = get({
    isOnline: true, pendingCount: 3
  })
  const next = get({
    isOnline: false, pendingCount: 3
  })
  assert.equal(visible(next, x.key), true)
})

check('Mudanca no numero pendente volta a aparecer', () => {
  const a = get({
    isOnline: true, pendingCount: 1
  })
  const b = get({
    isOnline: true, pendingCount: 2
  })
  assert.equal(visible(b, a.key), true)
})

check('Ausencia de alerta permanece invisivel', () => {
  assert.equal(visible(null, null), false)
})

check('Componente usa politica compartilhada', () => {
  const s = read(componentFile)
  assert.ok(s.includes('getNetworkNotice('))
  assert.ok(s.includes('shouldShowNetworkNotice('))
})

check('Componente usa Lucide', () => {
  assert.ok(read(componentFile).includes("from 'lucide-react'"))
})

check('Componente oferece feedback tatil', () => {
  const s = read(componentFile)
  assert.ok(s.includes('useHapticFeedback'))
  assert.ok(s.includes('light()'))
})

check('Componente preserva safe area', () => {
  assert.ok(read(componentFile).includes('env(safe-area-inset-top)'))
})

check('Componente respeita movimento reduzido', () => {
  assert.ok(read(componentFile).includes('motion-reduce:animate-none'))
})

check('Componente tem dismiss acessivel', () => {
  assert.ok(read(componentFile).includes('aria-label="Dispensar aviso de conexão"'))
})

check('Componente nao faz leitura remota', () => {
  assert.ok(!/fetch\(|supabase|useLocalData|useLocalSync/.test(read(componentFile)))
})

check('Politica nao manipula ledger', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|db\./.test(read(policyFile)))
})

check('Workflow inclui V183', () => {
  assert.ok(read(workflowFile)
    .includes('node scripts/check-v183-network-premium.mjs'))
})

console.log(`V183: ${count} contratos aprovados.`)
