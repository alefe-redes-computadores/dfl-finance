import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')

const engineFile = 'src/lib/syncEngine.ts'
const modelFile = 'src/lib/syncBadgePresentation.ts'
const safetyFile = 'src/lib/syncSafetyPresentation.ts'
const buttonFile = 'src/components/SyncButton.tsx'
const indicatorFile = 'src/components/SyncStatusIndicator.tsx'
const homeFile = 'src/app/(app)/home/page.tsx'
const workflowFile = '.github/workflows/android-build.yml'

const engine = read(engineFile)
const modelSource = read(modelFile)
const home = read(homeFile)
const button = read(buttonFile)
const indicator = read(indicatorFile)
const workflow = read(workflowFile)

let tests = 0
const check = (name, fn) => {
  fn()
  tests++
  console.log('✓', name)
}

for (const file of [
  engineFile, modelFile, buttonFile,
  indicatorFile, homeFile
]) {
  check(`Sintaxe válida: ${file}`, () => {
    const parsed = ts.createSourceFile(
      file,
      read(file),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx')
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS
    )
    assert.equal(parsed.parseDiagnostics.length, 0)
  })
}

const transpile = (source, file) =>
  ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020
    }
  }).outputText

// Executa a função real de comparação em isolamento.
// Não importa o motor completo nem acessa IndexedDB.
const begin = engine.indexOf('function setSnapshot(')
const end = engine.indexOf('\nfunction renderLog(', begin)

check('Função de snapshot identificada unicamente', () => {
  assert.ok(begin > 0 && end > begin)
  assert.equal(engine.indexOf('function setSnapshot(', begin + 1), -1)
})

const originalFunction = engine.slice(begin, end)
const compiledFunction = transpile(originalFunction, engineFile)

const createHarness = () => new Function(`
  let snapshot = {
    syncStatus: 'online',
    isOnline: true,
    pendingCount: 0,
    hasFinancialOutbox: false,
    isSyncing: false,
    isBalanceReconciling: false,
    balanceVerifiedAt: null,
    lastSuccessfulSyncAt: null,
    lastSyncError: null
  };
  let emissions = 0;
  function emit() { emissions++; }
  ${compiledFunction}
  return {
    patch: value => setSnapshot(value),
    current: () => snapshot,
    emissions: () => emissions
  };
`)()

check('Snapshot igual não gera rerender inútil', () => {
  const h = createHarness()
  h.patch({ pendingCount: 0 })
  assert.equal(h.emissions(), 0)
})

check('Erro isolado gera nova emissão', () => {
  const h = createHarness()
  h.patch({ lastSyncError: 'Falha remota' })
  assert.equal(h.emissions(), 1)
  assert.equal(h.current().lastSyncError, 'Falha remota')
})

check('Limpar erro isoladamente gera emissão', () => {
  const h = createHarness()
  h.patch({ lastSyncError: 'Falha remota' })
  h.patch({ lastSyncError: null })
  assert.equal(h.emissions(), 2)
})

check('Confirmação remota isolada gera emissão', () => {
  const h = createHarness()
  h.patch({
    lastSuccessfulSyncAt: '2026-10-24T20:00:00.000Z'
  })
  assert.equal(h.emissions(), 1)
})

check('Outbox preservado gera emissão', () => {
  const h = createHarness()
  h.patch({ hasFinancialOutbox: true })
  assert.equal(h.emissions(), 1)
})

check('Limpeza de outbox gera emissão', () => {
  const h = createHarness()
  h.patch({ hasFinancialOutbox: true })
  h.patch({ hasFinancialOutbox: false })
  assert.equal(h.emissions(), 2)
})

check('Status de sincronização mantém deduplicação', () => {
  const h = createHarness()
  h.patch({ isSyncing: true, syncStatus: 'syncing' })
  h.patch({ isSyncing: true, syncStatus: 'syncing' })
  assert.equal(h.emissions(), 1)
})

const safetyExports = {}
new Function(
  'exports',
  transpile(read(safetyFile), safetyFile)
)(safetyExports)

const modelExports = {}
new Function(
  'exports',
  'require',
  transpile(modelSource, modelFile)
)(
  modelExports,
  spec => {
    assert.equal(spec, './syncSafetyPresentation')
    return safetyExports
  }
)

const derive = modelExports.getSyncBadgePresentation

const defaults = {
  isOnline: true,
  isSyncing: false,
  pendingCount: 0,
  hasFinancialOutbox: false,
  lastSuccessfulSyncAt: null,
  lastSyncError: null
}

const badge = overrides =>
  derive({ ...defaults, ...overrides })

check('Fila vazia sem confirmação NÃO aparece verde', () => {
  assert.equal(badge({}).kind, 'unverified')
})

check('Confirmação válida permite estado verificado', () => {
  assert.equal(badge({
    lastSuccessfulSyncAt: '2026-10-24T20:00:00Z'
  }).kind, 'verified')
})

check('Outbox sem fila não aparece verificado', () => {
  assert.equal(badge({
    hasFinancialOutbox: true,
    lastSuccessfulSyncAt: '2026-10-24T20:00:00Z'
  }).kind, 'pending')
})

check('Erro prevalece sobre confirmação anterior', () => {
  assert.equal(badge({
    lastSuccessfulSyncAt: '2026-10-24T20:00:00Z',
    lastSyncError: 'Falha'
  }).kind, 'error')
})

check('Conflito remoto recebe mensagem segura', () => {
  const x = badge({
    lastSyncError: 'DFL_SYNC_CONFLICT'
  })
  assert.equal(x.kind, 'error')
  assert.ok(x.detail.includes('preservada'))
})

check('Offline não aparece como sincronizado', () => {
  assert.equal(badge({
    isOnline: false,
    lastSuccessfulSyncAt: '2026-10-24T20:00:00Z'
  }).kind, 'offline')
})

check('Sincronização ativa não aparece como concluída', () => {
  assert.equal(badge({
    isSyncing: true,
    lastSuccessfulSyncAt: '2026-10-24T20:00:00Z'
  }).kind, 'syncing')
})

check('Fila pendente domina confirmação anterior', () => {
  assert.equal(badge({
    pendingCount: 3,
    lastSuccessfulSyncAt: '2026-10-24T20:00:00Z'
  }).kind, 'pending')
})

check('Contagem inválida não vira badge fictício', () => {
  assert.equal(badge({
    pendingCount: Number.NaN
  }).pending, 0)
})

check('Contagem de fila normalizada', () => {
  assert.equal(badge({
    pendingCount: 4.9
  }).pending, 4)
})

check('Home passa confirmação e outbox para componente', () => {
  for (const token of [
    'lastSuccessfulSyncAt={lastSuccessfulSyncAt}',
    'hasFinancialOutbox={!!hasFinancialOutbox}',
    'lastSyncError={lastSyncError}'
  ]) {
    assert.ok(home.includes(token), token)
  }
})

check('Home conserva botão e modal existentes', () => {
  assert.ok(home.includes('<SyncButton'))
  assert.ok(home.includes('<SyncStatusModal'))
})

check('Home conserva feedback de falhas', () => {
  assert.ok(home.includes('hasSyncFailure'))
  assert.ok(home.includes('forceSync({ silentSuccess: true })'))
})

check('Botão usa apresentação autoritativa', () => {
  assert.ok(button.includes('getSyncBadgePresentation('))
  assert.ok(button.includes('state.kind'))
})

check('Botão tem Lucide e feedback tátil', () => {
  assert.ok(button.includes('useHapticFeedback'))
  assert.ok(button.includes('light()'))
  assert.ok(button.includes('ShieldCheck'))
  assert.ok(button.includes('AlertTriangle'))
})

check('Botão tem estado de foco e acessibilidade', () => {
  assert.ok(button.includes('aria-label='))
  assert.ok(button.includes('focus-visible:ring-2'))
  assert.ok(button.includes('motion-reduce:'))
})

check('Indicador auxiliar reutiliza mesmo motor visual', () => {
  assert.ok(indicator.includes('getSyncBadgePresentation('))
  assert.ok(indicator.includes('useHapticFeedback'))
  assert.ok(indicator.includes('SyncStatusModal'))
})

check('Indicador respeita safe area', () => {
  assert.ok(indicator.includes('var(--safe-area-top)'))
})

check('Motor não altera algoritmo de pull/push', () => {
  assert.ok(engine.includes('processSyncQueue('))
  assert.ok(engine.includes('protectedNow'))
  assert.ok(engine.includes('confirmSyncSuccessIfCurrent'))
  assert.ok(engine.includes('markSyncFailedIfCurrent'))
})

check('Apresentador não escreve dados', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(|fetch\(/.test(modelSource))
})

check('Botão não escreve dados', () => {
  assert.ok(!/\.rpc\(|\.insert\(|\.update\(|\.delete\(/.test(button))
})

check('Workflow executa V175–V180', () => {
  for (const version of [175, 176, 177, 178, 179, 180]) {
    assert.ok(
      workflow.includes(`node scripts/check-v${version}-`),
      `V${version} ausente no Android`
    )
  }
})

check('Workflow conserva assinatura Android', () => {
  assert.ok(workflow.includes('DFL_FINANCE_STABLE_SIGNING_V1'))
})

check('Workflow não publica Play Store', () => {
  assert.ok(!workflow.includes('gradlew publish'))
})

console.log(
  `\nV180: ${tests} contratos funcionais e estruturais aprovados.`
)
