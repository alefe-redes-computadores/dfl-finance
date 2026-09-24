import fs from 'node:fs'

function assertContract(condition, message) {
  if (!condition) {
    throw new Error(
      `V28 FINAL CONTRACT: ${message}`
    )
  }
}

const manifestPath =
  'android/app/src/main/AndroidManifest.xml'

assertContract(
  fs.existsSync(manifestPath),
  'AndroidManifest final ausente.'
)

const manifest =
  fs.readFileSync(manifestPath, 'utf8')

assertContract(
  manifest.includes(
    'android.permission.POST_NOTIFICATIONS'
  ),
  'APK sem POST_NOTIFICATIONS.'
)

const activityCandidates = [
  'android/app/src/main/java/com/dflfinance/app/MainActivity.java',
  'android/app/src/main/java/com/dflfinance/app/MainActivity.kt',
]

const activityPath =
  activityCandidates.find((file) =>
    fs.existsSync(file)
  )

assertContract(
  activityPath,
  'MainActivity final não encontrada.'
)

const activity =
  fs.readFileSync(activityPath, 'utf8')

assertContract(
  activity.includes(
    'DFL_FINANCE_SYSTEM_BARS_V29_VAULT_DONOR'
  ),
  'Marker V15 ausente.'
)

assertContract(
  activity.includes(
    'setDecorFitsSystemWindows'
  ),
  'Edge-to-edge ausente.'
)

assertContract(
  activity.includes('TRANSPARENT'),
  'Barras transparentes ausentes.'
)

assertContract(
  activity.includes(
    'setAppearanceLightStatusBars(false)'
  ) ||
    activity.includes(
      'isAppearanceLightStatusBars = false'
    ),
  'Status bar sem ícones claros.'
)

const runtime = fs.readFileSync('src/components/CapacitorStatusBar.tsx', 'utf8')
assertContract(runtime.includes("registerPlugin<SystemBarsPlugin>('SystemBars')"), 'Ponte SystemBars ausente no React.')
assertContract(runtime.includes("SystemBars.setTheme({ dark: theme === 'dark' })"), 'Tema não é comunicado à ponte nativa.')
const androidStart = runtime.indexOf("if (platform === 'android')")
const androidReturn = runtime.indexOf('return', androidStart)
assertContract(androidStart >= 0 && androidReturn > androidStart, 'Ramo Android inválido.')
assertContract(runtime.indexOf('StatusBar.setStyle', androidStart) > androidReturn, 'React Android não pode controlar StatusBar.setStyle.')
assertContract(runtime.indexOf('StatusBar.setOverlaysWebView', androidStart) > androidReturn, 'React Android não pode controlar overlay.')

const javaRoot = 'android/app/src/main/java'

const javaFiles = fs
  .readdirSync(javaRoot, {
    recursive: true,
    withFileTypes: true,
  })
  .filter((entry) => entry.isFile())
  .map((entry) =>
    `${entry.parentPath || entry.path}/${entry.name}`
  )

const systemBarsPlugin = javaFiles.find(
  (candidate) =>
    candidate.endsWith('SystemBarsPlugin.java')
)
assertContract(Boolean(systemBarsPlugin), 'SystemBarsPlugin.java ausente no Android final.')
const systemBarsSource = fs.readFileSync(systemBarsPlugin, 'utf8')
assertContract(systemBarsSource.includes('@CapacitorPlugin(name = "SystemBars")'), 'Plugin SystemBars sem anotação Capacitor.')
assertContract(systemBarsSource.includes('.setAppearanceLightStatusBars(!dark)'), 'Plugin SystemBars sem contraste dinâmico.')
assertContract(activity.includes('registerPlugin(SystemBarsPlugin.class);'), 'SystemBarsPlugin não registrado na MainActivity.')

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
assertContract(Boolean(packageJson.dependencies?.['@capacitor/local-notifications'] || packageJson.devDependencies?.['@capacitor/local-notifications']), '@capacitor/local-notifications ausente.')

const notifications =
  fs.readFileSync(
    'src/lib/nativeNotifications.ts',
    'utf8'
  )

assertContract(
  notifications.includes(
    'LocalNotifications.checkPermissions()'
  ),
  'checkPermissions ausente.'
)

assertContract(
  notifications.includes(
    'LocalNotifications.requestPermissions()'
  ),
  'requestPermissions ausente.'
)

assertContract(
  notifications.includes(
    "permission.display === 'prompt'"
  ),
  'Tratamento de prompt ausente.'
)

assertContract(
  notifications.includes(
    "getNativeNotificationPermission()) === 'granted'"
  ),
  'Validação check-only de granted ausente.'
)

console.log(
  '============================================================'
)
console.log(
  'V28 FINAL ANDROID CONTRACT OK'
)
console.log(
  'POST_NOTIFICATIONS: OK'
)
console.log(
  'STATUS BAR V29 VAULT DONOR: OK'
)
console.log(
  'RUNTIME PERMISSION REQUEST: OK'
)
console.log(
  '============================================================'
)

// DFL_FINANCE_NOTIFICATION_VECTOR_V30
const notificationVector = 'android/app/src/main/res/drawable/ic_stat_dfl_finance.xml'
if (!fs.existsSync(notificationVector)) {
  throw new Error('VectorDrawable ic_stat_dfl_finance ausente no Android final.')
}
const notificationXml = fs.readFileSync(notificationVector, 'utf8')
if (!notificationXml.includes('<vector') ||
    !notificationXml.includes('android:fillColor="#FFFFFFFF"')) {
  throw new Error('ic_stat_dfl_finance final não é VectorDrawable monocromático Android-safe.')
}
