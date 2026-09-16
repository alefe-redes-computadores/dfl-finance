import fs from 'node:fs'

const read = (file) => fs.readFileSync(file, 'utf8')

const ok = (condition, message) => {
  if (!condition) throw new Error(message)
}

const workflow = read('.github/workflows/android-build.yml')
const runtime = read('src/components/CapacitorStatusBar.tsx')
const patch = read('scripts/patch-android-edge-to-edge-v14-8.mjs')
const capacitor = read('capacitor.config.ts')

ok(
  capacitor.includes('overlaysWebView: true'),
  'Capacitor precisa manter overlaysWebView=true'
)

ok(
  runtime.includes('StatusBar.setOverlaysWebView({ overlay: true })'),
  'runtime precisa reafirmar overlay'
)

ok(
  runtime.includes('style: Style.Light'),
  'runtime nativo precisa usar ícones claros'
)

ok(
  !runtime.includes("classList.contains('dark')"),
  'system bar não pode depender da classe dark do HTML'
)

ok(
  runtime.includes("'visibilitychange'"),
  'runtime precisa reaplicar system bars ao voltar ao foreground'
)

ok(
  patch.includes('setDecorFitsSystemWindows'),
  'patch sem edge-to-edge'
)

ok(
  patch.includes('setAppearanceLightStatusBars(false)') ||
    patch.includes('isAppearanceLightStatusBars = false'),
  'patch sem contrato de ícones claros'
)

ok(
  patch.includes('onResume'),
  'patch precisa reafirmar system bars em onResume'
)

const lastSync = workflow.lastIndexOf('npx cap sync android')
const patchIndex = workflow.indexOf(
  'node scripts/patch-android-edge-to-edge-v14-8.mjs'
)

ok(lastSync >= 0, 'workflow sem cap sync android')
ok(
  patchIndex > lastSync,
  'patch V14.8 precisa executar após o último cap sync'
)

ok(
  !workflow.includes(
    'node scripts/patch-android-edge-to-edge-v14-7.mjs'
  ),
  'workflow ainda executa patch V14.7'
)

console.log('V14.8 SYSTEM BARS CONTRACT OK')
