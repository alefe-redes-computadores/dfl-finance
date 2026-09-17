import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')

const ok = (condition, message) => {
  if (!condition) throw new Error(message)
}

const workflow = read('.github/workflows/android-build.yml')
const runtime = read('src/components/CapacitorStatusBar.tsx')
const patch = read('scripts/patch-android-system-bars-v15.mjs')
const capacitor = read('capacitor.config.ts')

ok(
  capacitor.includes('overlaysWebView: true'),
  'capacitor.config precisa preservar overlaysWebView=true'
)

ok(
  capacitor.includes("style: 'LIGHT'"),
  'capacitor.config perdeu o contrato existente da StatusBar'
)

/*
 * React pode manter as chamadas para iOS, mas precisa possuir
 * uma barreira explícita que encerra a execução no Android
 * ANTES dessas chamadas.
 */
const androidGuard = runtime.indexOf(
  "if (platform === 'android')"
)

const overlayCall = runtime.indexOf(
  'await StatusBar.setOverlaysWebView'
)

const styleCall = runtime.indexOf(
  'await StatusBar.setStyle'
)

ok(
  runtime.includes('Capacitor.getPlatform()'),
  'runtime precisa distinguir Android de iOS'
)

ok(
  androidGuard >= 0,
  'runtime sem barreira Android'
)

ok(
  overlayCall > androidGuard,
  'setOverlaysWebView precisa estar depois da saída Android'
)

ok(
  styleCall > androidGuard,
  'setStyle precisa estar depois da saída Android'
)

ok(
  !runtime.includes("'visibilitychange'") &&
    !runtime.includes('"visibilitychange"'),
  'runtime não deve reafirmar StatusBar por visibilitychange'
)

ok(
  patch.includes('DFL_FINANCE_SYSTEM_BARS_V15'),
  'marker V15 ausente'
)

ok(
  patch.includes('WindowCompat.setDecorFitsSystemWindows'),
  'patch sem edge-to-edge'
)

ok(
  patch.includes('setStatusBarColor') ||
    patch.includes('statusBarColor'),
  'patch sem status bar transparente'
)

ok(
  patch.includes('setNavigationBarColor') ||
    patch.includes('navigationBarColor'),
  'patch sem navigation bar transparente'
)

ok(
  patch.includes('setAppearanceLightStatusBars(false)') ||
    patch.includes('isAppearanceLightStatusBars = false'),
  'patch sem contrato de ícones claros'
)

/*
 * Não procuramos simplesmente a palavra onResume no arquivo,
 * porque as validações do próprio patch mencionam esse nome.
 * O contrato gerado não pode possuir override de lifecycle.
 */
ok(
  !patch.includes('public void onResume()') &&
    !patch.includes('override fun onResume()'),
  'patch V15 não pode gerar onResume'
)

ok(
  !patch.includes('void onWindowFocusChanged(') &&
    !patch.includes('fun onWindowFocusChanged('),
  'patch V15 não pode gerar onWindowFocusChanged'
)

const lastSync = workflow.lastIndexOf(
  'npx cap sync android'
)

const patchIndex = workflow.indexOf(
  'node scripts/patch-android-system-bars-v15.mjs'
)

ok(
  lastSync >= 0,
  'workflow sem cap sync android'
)

ok(
  patchIndex > lastSync,
  'patch V15 precisa executar depois do último cap sync'
)

ok(
  !workflow.includes(
    'node scripts/patch-android-edge-to-edge-v14-8.mjs'
  ),
  'workflow ainda executa patch V14.8'
)

ok(
  !workflow.includes(
    'node scripts/patch-android-edge-to-edge-v14-7.mjs'
  ),
  'workflow ainda executa patch V14.7'
)

console.log(
  'DFL FINANCE V15 — VAULT SYSTEM BARS CONTRACT: OK'
)
