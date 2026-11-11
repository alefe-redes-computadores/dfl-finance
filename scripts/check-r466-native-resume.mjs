/** R466 — contratos hermeticos do fluxo de retorno. Nao abre links nem instala APK. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const read = file => fs.readFileSync(file, 'utf8')
const page = read('src/app/(app)/updates/page.tsx')
const notes = read('src/lib/financeReleaseNotes.ts')
const workflow = read('.github/workflows/android-build.yml')
const test = read('src/__tests__/nativeApkResumeR466.test.tsx')
let n = 0
const check = (name, condition) => { assert.ok(condition, `R466: ${name}`); n++ }
for (const path of ['src/app/(app)/updates/page.tsx','src/lib/financeReleaseNotes.ts','src/__tests__/nativeApkResumeR466.test.tsx']) {
  const ast = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  check(`TS/TSX valido: ${path}`, !ast.parseDiagnostics.length)
}
check('Captura versao verificada antes de abrir as configuracoes', page.includes('permissionReturnRef.current = latest') && page.includes('await native.openInstallSettings()'))
check('Limpa a tentativa se as configuracoes falharem', page.includes("permissionReturnRef.current = null\n      setNativeError('Não foi possível abrir as configurações do Android.')"))
check('Retorno nativo observado', page.includes("App.addListener('appStateChange'"))
check('Retorno de visibilidade observado', page.includes("document.addEventListener('visibilitychange', onVisible)"))
check('Listener de visibilidade removido', page.includes("document.removeEventListener('visibilitychange', onVisible)"))
check('Evento so opera com retorno real de Settings', page.includes('const pending = permissionReturnRef.current') && page.includes('if (!pending) return'))
check('Consome o evento antes da tentativa', page.indexOf('permissionReturnRef.current = null\n      void installNow(pending)') > 0)
check('Instalacao repetida bloqueada', page.includes('installBusyRef.current') && page.includes('if (!native || !release.direct || installBusyRef.current) return'))
check('Mantem verificacao nativa', page.includes('native.installVerified({ build: release.build, sha256: release.direct.sha256 })'))
check('Nao repete download ao retomar', page.includes('void installNow(pending)') && !page.includes('void downloadAndInstall(pending)'))
check('Retorno automatico explicado', page.includes('Ao voltar, continuaremos a instalação automaticamente.'))
check('Permissao continua explicita', page.includes('Abrir permissões do Android') && page.includes('permissionRequired'))
check('Recuperacao manual discreta', page.includes('Já autorizei, mas não continuou? Tentar instalar'))
check('Nao usa dois CTAs primarios durante autorizacao', !page.includes('Já autorizei · instalar agora') && page.includes("nativePhase === 'idle' || (nativePhase === 'error'"))
check('Instalador do Android ainda depende de confirmacao', page.includes('Confirme a atualização na tela do sistema'))
check('Fallback GitHub preservado', page.includes('Abrir GitHub Actions') && page.includes('Alternativa: página de download da versão'))
check('Distribuicao original segura preservada', read('native/r464/DflApkUpdaterPlugin.java').includes('verifyPackage(file, build)') && read('native/r464/DflApkUpdaterPlugin.java').includes('canRequestPackageInstalls()'))
check('Testa retorno duplo e sem permissao', test.includes('mockResumeListener?.({ isActive: true })') && test.includes('sem autorização'))
check('CI executa os testes', workflow.includes('name: R466 Native Updater Permission Resume UX') && workflow.includes('node scripts/check-r466-native-resume.mjs') && workflow.includes('nativeApkResumeR466.test.tsx'))
check('Notas R466 antes da R465', notes.indexOf("version: 'R466'") > -1 && notes.indexOf("version: 'R466'") < notes.indexOf("version: 'R465'"))
check('Changelog presente', read('CHANGELOG.md').includes('## R466'))
console.log(`R466_NATIVE_RESUME_OK: ${n} contratos. Prova de APK real requer GitHub Actions e teste no aparelho.`)
