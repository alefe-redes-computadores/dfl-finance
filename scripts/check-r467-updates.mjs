import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const read = p => fs.readFileSync(p,'utf8')
const files = [
  'src/lib/apkUpdateAlertPolicy.ts', 'src/lib/apkUpdateNotifications.ts',
  'src/lib/nativeApkUpdater.ts', 'src/app/(app)/updates/page.tsx',
  'src/components/AppUpdateBanner.tsx', 'src/__tests__/apkUpdateAlertPolicyR467.test.ts',
]
for(const p of files){
  const src=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  assert.equal(src.parseDiagnostics.length,0,`R467 sintaxe ${p}`)
}
let n=0
const ok=(name,v)=>{assert.ok(v,`R467: ${name}`);n++}
const java=read('native/r464/DflApkUpdaterPlugin.java')
for (const mark of ['cancelDownload(PluginCall call)','cancellationRequested.set(true)','cancellationRequested.get()', 'if (temp != null && temp.exists()) temp.delete()', 'SHA-256','verifyPackage(target, build)','verifyPackage(file, build)','canRequestPackageInstalls()', 'FLAG_GRANT_READ_URI_PERMISSION']) ok(`Java ${mark}`,java.includes(mark))
ok('Sem instalador silencioso',!java.includes('PackageInstaller.Session'))
const page=read('src/app/(app)/updates/page.tsx')
for(const mark of ['cancelDownload()','downloadBytes','downloadCancelling','role="progressbar"','Cancelar download','setApkUpdateAlertsEnabled','Avisar sobre novos APKs','await installNow(release)','permissionReturnRef.current']) ok(`page ${mark}`,page.includes(mark))
const notify=read('src/lib/apkUpdateNotifications.ts')
for (const mark of ['requestPermissions()','checkPermissions()','notifyApkUpdateOnce','shouldAnnounceApkUpdate','route: \'/updates\'','schedule: { at: new Date(Date.now() + 2500) }','apkUpdateAlertsEnabled()']) ok(`alertas ${mark}`,notify.includes(mark))
const banner=read('src/components/AppUpdateBanner.tsx')
ok('Home preserva CTA',banner.includes('Atualizar no Finance')&&banner.includes('Lembrar depois'))
ok('Observer global com alerta uma vez por build',banner.includes('notifyApkUpdateOnce('))
const bridge=read('src/lib/nativeApkUpdater.ts')
ok('Bridge expõe cancelamento',bridge.includes('cancelDownload(): Promise<{ requested: boolean }>'))
ok('R466 permanece na release',read('src/lib/financeReleaseNotes.ts').includes("version: 'R466'"))
ok('CI inclui R467',read('.github/workflows/android-build.yml').includes('node scripts/check-r467-updates.mjs'))
ok('Bot e Supabase intocados',!files.some(p=>p.startsWith('supabase/')))
console.log(`R467_UPDATE_360_OK: ${n} contratos e ${files.length} fontes TS/TSX parseadas, sem banco ou bot.`)
