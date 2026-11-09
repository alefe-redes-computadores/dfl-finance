/** R461 — gate de segurança, documentação e proteção de funcionalidades legadas. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = p => fs.readFileSync(p, 'utf8')
const routes = ['src/app/api/ocr-receipt/route.ts','src/app/api/extract-invoice/route.ts']
for (const path of [...routes,'src/app/api/assistant/chat/route.ts','src/app/layout.tsx','src/app/not-found.tsx','src/lib/server/receiptUrlSecurity.ts','src/lib/financeReleaseNotes.ts','src/app/(app)/updates/page.tsx','src/__tests__/r461Security.test.ts']) {
  const a = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest,true,path.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  assert.equal(a.parseDiagnostics.length,0,`R461: sintaxe ${path}`)
}
let n=0
function check(name,v) { assert.ok(v,`R461: ${name}`);n++ }
for (const route of routes) {
  const code=read(route)
  check(`${route} JWT`,code.includes('supabase.auth.getUser(') || code.includes('supabase.auth.getUser(accessToken)') || /\.auth\s*\.getUser\s*\(/.test(code))
  check(`${route} OPTIONS`,code.includes('export function OPTIONS(') && code.includes('assistantNativePreflight(request)'))
  check(`${route} POST CORS`,code.includes('withAssistantNativeCors(request, await handle'))
  check(`${route} sem CORS *`,!code.includes("'Access-Control-Allow-Origin': '*'"))
}
const receipt=read(routes[0])
check('OCR usa proprietário autenticado',receipt.includes('validateReceiptUrl(body?.imageUrl, user.id)'))
check('OCR assinado, não público',receipt.includes('validateOwnSignedReceiptUrl(') && !receipt.includes("'/storage/v1/object/public/receipts/'"))
check('OCR tamanho 10 MB',receipt.includes('MAX_AI_FILE_BYTES'))
check('OCR sem redirect',receipt.includes("redirect: 'error'"))
const ai=read('src/app/api/assistant/chat/route.ts')
check('Assistente conserva login',ai.includes('.getUser('))
check('Gemini server-only',ai.includes('process.env')&&ai.includes('GEMINI_API_KEY'))
check('Não devolve erro interno',!ai.includes("error?.message ||\n              'Erro ao consultar o assistente.'"))
check('Sem mensagem do provedor no streaming',ai.includes('O assistente não conseguiu concluir a resposta. Tente novamente.'))
const config=read('next.config.js'),layout=read('src/app/layout.tsx'),robots=read('public/robots.txt')
check('Noindex em metadados',layout.includes('robots: { index: false, follow: false'))
check('Robots bloqueia indexação',robots.includes('User-agent: *')&&robots.includes('Disallow: /'))
check('Headers não entram no export mobile',config.includes('isMobileBuild ? {} : {')&&config.includes('async headers()'))
for (const header of ['X-Content-Type-Options','Referrer-Policy','X-Frame-Options','X-Robots-Tag','Permissions-Policy']) check(`Header ${header}`,config.includes(header))
check('Offline preservado',config.includes('cacheOnFrontEndNav: true')&&config.includes('reloadOnOnline: false'))
const updates=read('src/app/(app)/updates/page.tsx')
check('Novidades no aplicativo',updates.includes('O que mudou no Finance')&&updates.includes('FINANCE_RELEASE_NOTES.map'))
check('APK real preservado',updates.includes('useApkUpdate(true)')&&updates.includes('Último APK certificado'))
check('404 personalizada',read('src/app/not-found.tsx').includes('404')&&read('src/app/not-found.tsx').includes('href="/home"'))
check('Changelog existente',read('CHANGELOG.md').includes('R461')&&read('CHANGELOG.md').includes('R460'))
check('README proíbe git add -A',read('README.md').includes('não usar `git add .`/`git add -A`'))
check('README documenta bucket privado',read('README.md').includes('bucket privado'))
check('Não existe sitemap de finanças',!fs.existsSync('public/sitemap.xml')&&!fs.existsSync('src/app/sitemap.ts'))
const wf=read('.github/workflows/android-build.yml')
for (const r of ['r456-app-updates','r457-notification-center','r458-proactive-intelligence','r459-closeout','r460-search-turbo','r461-final-security'])
 check(`CI preserva ${r}`,wf.includes(r))
check('Console Eruda bloqueado em produção',read('src/components/admin/ErudaToggler.tsx').includes("process.env.NODE_ENV !== 'development'"))
check('Bot intacto',fs.existsSync('supabase/functions/whatsapp-webhook/index.ts'))
check('Motor financeiro intacto',fs.existsSync('src/lib/financialMetrics.ts'))
check('Sem token dentro de documento',!/(GEMINI_API_KEY\s*=\s*[\w-]{15}|SERVICE_ROLE_KEY\s*=\s*[\w-]{15})/.test(read('README.md')+read('CHANGELOG.md')))

const helper=read('src/lib/server/receiptUrlSecurity.ts')
const transpiled=ts.transpileModule(helper,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true})
assert.equal(transpiled.diagnostics?.length??0,0)
const exports={}
new Function('exports',transpiled.outputText)(exports)
const uid='11111111-2222-4333-8444-555555555555'
const host='https://bwggczkzsqcdeayyysmx.supabase.co'
const valid=`${host}/storage/v1/object/sign/receipts/${uid}/abc-123.jpg?token=example-token-correct-length`
const allow=exports.validateOwnSignedReceiptUrl
check('URL própria',allow(valid,host,uid)===valid)
for(const [reason,v,owner] of [
 ['Outro proprietário',valid,'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'],
 ['Origem não confiável',valid.replace(host,'https://evil.example'),uid],
 ['Link público',valid.replace('/sign/','/public/'),uid],
 ['Sem assinatura',valid.split('?')[0],uid],
 ['Pasta aninhada',valid.replace('abc-123.jpg','some%2Fother.jpg'),uid],
 ['PDF em OCR de imagem',valid.replace('.jpg','.pdf'),uid],
]) {
 let denied=false
 try { allow(v,host,owner) } catch { denied=true }
 check(reason,denied)
}
console.log(`R461_FINAL_SECURITY_OK: ${n} contratos, TypeScript, isolamento, CORS, README, release notes e CI`)
