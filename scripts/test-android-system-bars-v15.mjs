import fs from 'node:fs'
import path from 'node:path'

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
  patch.includes('DFL_FINANCE_SYSTEM_BARS_V29_VAULT_DONOR'),
  'marker V29 ausente'
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

// DFL_FINANCE_SYSTEM_BARS_V31_3_THEME_BRIDGE_TEST
const androidJavaRoot = 'android/app/src/main/java'

const mainActivityFiles = fs
  .readdirSync(androidJavaRoot, {
    recursive: true,
    withFileTypes: true,
  })
  .filter(
    (entry) =>
      entry.isFile() &&
      /MainActivity\.(java|kt)$/.test(entry.name)
  )
  .map((entry) =>
    path.join(entry.parentPath || entry.path, entry.name)
  )

ok(
  mainActivityFiles.length === 1,
  'V31.3 exige exatamente uma MainActivity Android'
)

const mainActivityFile = mainActivityFiles[0]

const pluginFiles = fs
  .readdirSync(path.dirname(mainActivityFile), { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name === 'SystemBarsPlugin.java'
  )
  .map((entry) =>
    path.join(path.dirname(mainActivityFile), entry.name)
  )
if (pluginFiles.length !== 1) {
  throw new Error('V31.3 exige exatamente um SystemBarsPlugin.java')
}
const pluginSource = fs.readFileSync(pluginFiles[0], 'utf8')
if (!pluginSource.includes('.setAppearanceLightStatusBars(!dark)')) {
  throw new Error('V31.3 sem contraste dinâmico nativo')
}
const finalMainActivity = fs.readFileSync(
  mainActivityFile,
  'utf8'
)

if (!finalMainActivity.includes('registerPlugin(SystemBarsPlugin.class);')) {
  throw new Error('V31.3 SystemBarsPlugin não registrado')
}

if (finalMainActivity.includes('\\\\n')) {
  throw new Error('MainActivity contém \\n literal e produzirá Java inválido')
}

if (!finalMainActivity.includes(
  'registerPlugin(SystemBarsPlugin.class);\n    super.onCreate(savedInstanceState);'
)) {
  throw new Error('Registro SystemBarsPlugin não precede super.onCreate em linha válida')
}
