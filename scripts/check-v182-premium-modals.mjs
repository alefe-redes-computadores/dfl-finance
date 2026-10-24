import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read = file => fs.readFileSync(file, 'utf8')
const select = read('src/components/SelectField.tsx')
const sync = read('src/components/SyncStatusModal.tsx')
const workflow = read('.github/workflows/android-build.yml')

let total = 0
function check(label, fn) {
  fn()
  total++
  console.log('✓', label)
}

for (const path of [
  'src/components/SelectField.tsx',
  'src/components/SyncStatusModal.tsx'
]) {
  check(`TSX parse: ${path}`, () => {
    const parsed = ts.createSourceFile(
      path, read(path),
      ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX
    )
    assert.equal(parsed.parseDiagnostics.length, 0)
  })
}

check('Select abre na opcao selecionada', () => {
  assert.ok(select.includes('selectedOption || firstOption'))
})

check('Select exclui opcoes desabilitadas do foco', () => {
  assert.ok(select.includes('button[data-selected="true"]:not(:disabled)'))
})

check('Select identifica opcoes', () => {
  assert.ok(select.includes('data-option="true"'))
  assert.ok(select.includes('data-selected={active'))
})

check('Select preserva navegacao Escape e Tab', () => {
  assert.ok(select.includes("event.key === 'Escape'"))
  assert.ok(select.includes("event.key === 'Tab'"))
})

check('Select preserva callback original', () => {
  assert.ok(select.includes('onChange(option.value)'))
  assert.ok(select.includes('vibrate([5])'))
})

check('Select suporta opcao desabilitada', () => {
  assert.ok(select.includes('disabled={option.disabled}'))
})

check('Select recupera foco do gatilho', () => {
  assert.ok(select.includes('triggerAtOpen?.focus()'))
})

check('Select respeita safe area', () => {
  assert.ok(select.includes('env(safe-area-inset-bottom)'))
})

check('Select mantem dialog e aria', () => {
  assert.ok(select.includes('aria-modal="true"'))
  assert.ok(select.includes('aria-controls={open ? titleId : undefined}'))
})

check('Modal restaura overflow anterior', () => {
  assert.ok(sync.includes('const previousOverflow'))
  assert.ok(sync.includes('document.body.style.overflow = previousOverflow'))
})

check('Modal suporta Escape', () => {
  assert.ok(sync.includes("event.key === 'Escape'"))
  assert.ok(sync.includes('onCloseRef.current()'))
})

check('Modal contem navegacao Tab', () => {
  assert.ok(sync.includes("event.key !== 'Tab'"))
  assert.ok(sync.includes('last.focus()'))
  assert.ok(sync.includes('first.focus()'))
})

check('Modal restaura foco', () => {
  assert.ok(sync.includes('previousFocus.focus()'))
})

check('Modal possui titulo acessivel', () => {
  assert.ok(sync.includes('aria-labelledby="dfl-sync-modal-title"'))
  assert.ok(sync.includes('id="dfl-sync-modal-title"'))
})

check('Modal fecha com botao acessivel', () => {
  assert.ok(sync.includes('aria-label="Fechar detalhes da sincronização"'))
  assert.ok(sync.includes('h-11 w-11'))
})

check('Modal conserva seguranca financeira', () => {
  assert.ok(sync.includes('syncSafetyStatus('))
  assert.ok(sync.includes('<SyncSafetyDetails />'))
})

check('Modal mantem comando de sincronizacao', () => {
  assert.ok(sync.includes('forceSync()'))
  assert.ok(sync.includes('disabled={isSyncing || !isOnlineStatus}'))
})

check('Modal conserva diagnostico de admin', () => {
  assert.ok(sync.includes('href="/admin/sync"'))
})

check('Modal usa Lucide', () => {
  assert.ok(sync.includes("from 'lucide-react'"))
})

check('Sem acesso direto ao ledger', () => {
  for (const value of [sync, select]) {
    assert.ok(!/db\.transactions|db\.accounts|supabase\.from/.test(value))
  }
})

check('Workflow exige V182', () => {
  assert.ok(workflow.includes(
    'node scripts/check-v182-premium-modals.mjs'
  ))
})

console.log(`V182: ${total} contratos aprovados.`)
