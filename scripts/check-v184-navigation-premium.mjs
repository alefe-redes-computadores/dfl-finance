import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const path = 'src/components/BottomNav.tsx'
const source = fs.readFileSync(path, 'utf8')
const workflow = fs.readFileSync(
  '.github/workflows/android-build.yml', 'utf8'
)

let total = 0

const check = (label, fn) => {
  fn()
  total++
  console.log('✓', label)
}

check('BottomNav tem sintaxe TSX valida', () => {
  const parsed = ts.createSourceFile(
    path, source, ts.ScriptTarget.Latest,
    true, ts.ScriptKind.TSX
  )
  assert.equal(parsed.parseDiagnostics.length, 0)
})

const start = source.indexOf(
  '  const navigateSafely = (path: string) => {'
)
const end = source.indexOf(
  '\n  const handleNavigate = (path: string) => {',
  start
)

check('Navegador identificado', () => {
  assert.ok(start > 0 && end > start)
})

const navigation = source.slice(start, end)

check('Navegacao continua client-side', () => {
  assert.ok(navigation.includes('router.push(path)'))
})

check('Sem reload forçado de pagina', () => {
  assert.ok(!navigation.includes('window.location.assign'))
  assert.ok(!navigation.includes('window.location.reload'))
})

check('Sem temporizador de 700ms', () => {
  assert.ok(!navigation.includes('setTimeout'))
})

check('Mesma rota nao precisa navegar', () => {
  assert.ok(navigation.includes('pathname === path'))
})

check('Botao central abre cadastro completo', () => {
  assert.ok(
    source.includes("navigateSafely('/transactions/new')")
  )
})

check('Receita abre cadastro completo', () => {
  assert.ok(
    source.includes("navigateSafely('/transactions/new?type=income')")
  )
})

check('Despesa abre cadastro completo', () => {
  assert.ok(
    source.includes("navigateSafely('/transactions/new?type=expense')")
  )
})

check('Cartao preservado', () => {
  assert.ok(
    source.includes("navigateSafely('/transactions/card-expense')")
  )
})

check('Busca global preservada', () => {
  assert.ok(source.includes("handleNavigate('/search')"))
})

check('Transferencia preservada', () => {
  assert.ok(source.includes('setIsTransferModalOpen(true)'))
})

check('Rapido permanece exclusivo da Home', () => {
  assert.ok(source.includes('aria-label="Lançamento rápido opcional"'))
  assert.ok(source.includes('{isHome && ('))
})

check('Menu fecha em mudanca de rota', () => {
  assert.ok(source.includes('setQuickActionOpen(false)\n  }, [pathname])'))
})

check('Escape fecha atalhos', () => {
  assert.ok(source.includes("event.key === 'Escape'"))
  assert.ok(source.includes("setIsOpen(false)"))
})

check('Listener Escape tem cleanup', () => {
  assert.ok(source.includes(
    "window.removeEventListener('keydown', closeOnEscape)"
  ))
})

check('Painel e gatilho associados', () => {
  assert.ok(source.includes(
    'aria-controls="dfl-home-quick-actions"'
  ))
  assert.ok(source.includes('id="dfl-home-quick-actions"'))
})

check('Haptic existente preservado', () => {
  assert.ok(source.includes('useHapticFeedback'))
  assert.ok(source.includes('vibrate([15])'))
})

check('Lucide preservado', () => {
  assert.ok(source.includes("from 'lucide-react'"))
})

check('BottomNav visivel via hook compartilhado', () => {
  assert.ok(source.includes('useBottomNavVisible()'))
})

check('Transacoes e Home preservadas', () => {
  for (const route of [
    '/home', '/transactions', '/analysis', '/more'
  ]) assert.ok(source.includes(`href: '${route}'`))
})

check('Painel respeita safe area', () => {
  assert.ok(source.includes('var(--safe-area-bottom)'))
})

check('Movimento reduzido suportado', () => {
  assert.ok(source.includes('motion-reduce:transition-none'))
})

check('Navegacao nao manipula banco', () => {
  assert.ok(!/db\.transactions|supabase\.from\(/.test(navigation))
})

check('Workflow Android exige V184', () => {
  assert.ok(workflow.includes(
    'node scripts/check-v184-navigation-premium.mjs'
  ))
})

console.log(`V184: ${total} contratos aprovados.`)
