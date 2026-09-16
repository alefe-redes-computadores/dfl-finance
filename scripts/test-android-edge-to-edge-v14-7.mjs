import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')

const ok = (condition, message) => {
  if (!condition) throw new Error(message)
}

const workflow = read('.github/workflows/android-build.yml')
const patch = read('scripts/patch-android-edge-to-edge-v14-7.mjs')
const statusBar = read('src/components/CapacitorStatusBar.tsx')
const capacitor = read('capacitor.config.ts')

ok(
  workflow.includes('patch-android-edge-to-edge-v14-7.mjs'),
  'workflow sem patch edge-to-edge'
)

const lastSync = workflow.lastIndexOf('npx cap sync android')
const nativePatch = workflow.indexOf(
  'node scripts/patch-android-edge-to-edge-v14-7.mjs'
)

ok(lastSync >= 0, 'cap sync android ausente')
ok(nativePatch > lastSync, 'patch precisa vir após o último cap sync')

ok(
  patch.includes('WindowCompat.setDecorFitsSystemWindows'),
  'WindowCompat edge-to-edge ausente'
)

ok(
  patch.includes('setStatusBarColor(Color.TRANSPARENT)') ||
    patch.includes('statusBarColor = Color.TRANSPARENT'),
  'status bar transparente ausente'
)

ok(
  patch.includes('setNavigationBarColor(Color.TRANSPARENT)') ||
    patch.includes('navigationBarColor = Color.TRANSPARENT'),
  'navigation bar transparente ausente'
)

ok(
  capacitor.includes('overlaysWebView: true'),
  'Capacitor overlaysWebView precisa permanecer true'
)

ok(
  statusBar.includes(
    'StatusBar.setOverlaysWebView({ overlay: true })'
  ),
  'runtime perdeu overlay'
)

ok(
  !statusBar.includes('StatusBar.setBackgroundColor'),
  'runtime não deve pintar a status bar no contrato V14.7'
)

ok(
  statusBar.includes('Style.Light') &&
    statusBar.includes('Style.Dark'),
  'contraste dinâmico dos ícones foi perdido'
)

console.log('DFL FINANCE V14.7 EDGE-TO-EDGE CONTRACTS OK')
