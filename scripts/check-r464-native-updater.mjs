/** R464 — contratos herméticos da distribuição direta + instalação Android consentida. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const read = file => fs.readFileSync(file, 'utf8')
const paths = ['src/lib/nativeApkUpdater.ts','src/lib/mobileUpdatePolicy.ts','src/lib/mobileUpdateService.ts',
  'src/app/(app)/updates/page.tsx','src/components/AppUpdateBanner.tsx','src/__tests__/nativeApkUpdateR464.test.ts']
for (const file of paths) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  assert.equal(ast.parseDiagnostics.length, 0, `R464: sintaxe ${file}`)
}
let n = 0
const check = (name, pass) => { assert.ok(pass, `R464: ${name}`); n++ }
const policy = read('src/lib/mobileUpdatePolicy.ts')
check('Somente release e Action do mesmo SHA', policy.includes('parseDirectApkRelease(') && policy.includes('matched.sha !== target'))
check('APK esperado e SHA256', policy.includes('sha256:') && policy.includes('DFL-Finance-${build}.apk'))
check('Fallback de 14 dias preservado', policy.includes('releaseFromArtifacts('))
const service = read('src/lib/mobileUpdateService.ts')
check('Consulta release pública sem token', service.includes('/releases/latest') && !/Authorization|Bearer|GITHUB_TOKEN|service_role/.test(service))
check('Uma Action aprovada precede a oferta', service.includes('parseSuccessfulApkRun') && service.includes('parseDirectApkRelease'))
const page = read('src/app/(app)/updates/page.tsx')
check('O app baixa APK pelo bridge nativo', page.includes('downloadVerified(') && page.includes('installVerified('))
check('Permissão não é silenciosa', page.includes('openInstallSettings(') && page.includes('permissionRequired'))
check('Página preserva fallback GitHub', page.includes('Abrir GitHub Actions') && page.includes('FINANCE_RELEASE_NOTES.map'))
const banner = read('src/components/AppUpdateBanner.tsx')
check('Banner conduz ao fluxo do app', banner.includes("router.push('/updates')"))
const java = read('native/r464/DflApkUpdaterPlugin.java')
for (const item of ['MessageDigest.getInstance("SHA-256")','verifyPackage(target, build)','verifyPackage(file, build)',
  'getPackageArchiveInfo','GET_SIGNING_CERTIFICATES','canRequestPackageInstalls','ACTION_MANAGE_UNKNOWN_APP_SOURCES',
  'FLAG_GRANT_READ_URI_PERMISSION','FileProvider.getUriForFile','downloadProgress','MAX_BYTES',
  'trustedDownloadHost','getSharedPreferences(PREFS']) check(`Java possui ${item}`, java.includes(item))
check('Nenhuma instalação silenciosa', !java.includes('PackageInstaller.Session') && !java.includes('pm.installPackage('))
const workflow = read('.github/workflows/android-build.yml')
check('Release só publica após build', workflow.includes('needs: android') && workflow.includes('name: Publish verified APK'))
check('Token com escopo isolado', workflow.includes('permissions:\n      contents: write') && workflow.includes('permissions:\n  contents: read'))
check('Vinculação release/commit', workflow.includes('--target "$GITHUB_SHA"'))
check('Build preserva APK assinado', workflow.includes('DFL_FINANCE_STABLE_SIGNING_V1'))
check('Action mantém artefato tradicional', workflow.includes('name: DFL-Finance-App') && workflow.includes('retention-days: 14'))
check('Native plugin aparece antes do Gradle', workflow.indexOf('node scripts/apply-r464-native-updater.mjs') < workflow.indexOf('Build debug APK'))
check('R464 integra testes na Action', workflow.includes('node scripts/check-r464-native-updater.mjs') && workflow.includes('nativeApkUpdateR464.test.ts'))
check('Changelog presente no app', read('src/lib/financeReleaseNotes.ts').includes("version: 'R464'"))
check('Changelog completo', read('CHANGELOG.md').includes('## R464'))
console.log(`R464_NATIVE_UPDATE_OK: ${n} contratos + ${paths.length} fontes parseadas. Não substitui build Android real.`)
