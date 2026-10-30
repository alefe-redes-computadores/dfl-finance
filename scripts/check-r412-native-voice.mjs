import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const read = name => fs.readFileSync(name,'utf8')
const paths=[
 'src/hooks/useFinancialSpeech.ts',
 'src/lib/voicePreferences.ts',
 'src/lib/voiceHandoff.ts',
 'src/components/FinanceVoiceOrb.tsx',
 'src/app/(app)/search/page.tsx',
 'src/components/BottomNav.tsx',
 'src/app/(app)/settings/page.tsx',
]
for (const file of paths){
  const tree=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
  assert.equal(tree.parseDiagnostics.length,0,`TSX/TS: ${file}`)
}
const pkg=JSON.parse(read('package.json'))
const lock=JSON.parse(read('package-lock.json'))
assert.equal(pkg.dependencies['@capacitor-community/speech-recognition'],'6.0.1')
assert.equal(lock.packages['node_modules/@capacitor-community/speech-recognition'].version,'6.0.1')
assert.ok(String(pkg.dependencies['@capacitor/core']).startsWith('^6'))

const speech=read('src/hooks/useFinancialSpeech.ts')
const orb=read('src/components/FinanceVoiceOrb.tsx')
const search=read('src/app/(app)/search/page.tsx')
const nav=read('src/components/BottomNav.tsx')
const settings=read('src/app/(app)/settings/page.tsx')
const home=read('src/app/(app)/home/page.tsx')
const form=read('src/app/(app)/transactions/new/page.tsx')
const ci=read('.github/workflows/android-build.yml')
for(const token of [
 'Capacitor.isNativePlatform()',
 "language: 'pt-BR'",
 'SpeechRecognition.checkPermissions()',
 'SpeechRecognition.requestPermissions()',
 'SpeechRecognition.start(',
 "recognizer.lang = 'pt-BR'",
 'recognizer.start()',
 'web.current?.abort()',
 'token.current',
 'setTranscript(value)',
]) assert.ok(speech.includes(token),`Speech: ${token}`)
for(const token of [
 'aria-label="Falar com DFL Finance"',
 'aria-modal="true"',
 'Começar a falar',
 'Parar de ouvir',
 'motion-safe:animate-pulse',
 'stageFinancialVoiceTranscript(transcript)',
 "router.push('/search?voice=1')",
 'Nenhuma movimentação é salva por voz',
]) assert.ok(orb.includes(token),`Orb: ${token}`)
assert.ok(search.includes('consumeFinancialVoiceTranscript()'))
assert.ok(search.includes('useFinancialSpeech()'))
assert.ok(search.includes('interpretFinancialInput(trimmedQuery)'))
assert.ok(search.includes('smartDraftUrl(smartDraft)'))
assert.ok(!search.includes('recognitionRef'))
assert.ok(nav.includes('<FinanceVoiceOrb pathname={pathname} />'))
assert.ok(nav.includes("navigateSafely('/transactions/new')"),'Botao + tradicional preservado')
assert.ok(settings.includes('setFinancialVoiceFabEnabled(event.target.checked)'))
assert.ok(home.includes('aria-label="DFL Comando financeiro"'))
assert.ok(form.includes("searchParams.get('intent') !== 'smart'"))
assert.ok(form.includes('submitLockRef.current'))
assert.ok(ci.includes('node scripts/check-r412-native-voice.mjs'))

function loadTs(file){
  const js=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const exports={}
  new Function('exports',js)(exports)
  return exports
}
const keys=new Map()
const events=[]
const fakeWindow={
  sessionStorage:{getItem:k=>keys.get(k)??null,setItem:(k,v)=>keys.set(k,v),removeItem:k=>keys.delete(k)},
  localStorage:{getItem:k=>keys.get(k)??null,setItem:(k,v)=>keys.set(k,v)},
  dispatchEvent:event=>events.push(event.type),
}
globalThis.window=fakeWindow
// Event do Node suporta apenas construcao; nenhuma API nativa de audio é chamada.
const handoff=loadTs('src/lib/voiceHandoff.ts')
assert.equal(handoff.stageFinancialVoiceTranscript('  paguei 286,40 ontem  '),true)
assert.equal(handoff.consumeFinancialVoiceTranscript(),'paguei 286,40 ontem')
assert.equal(handoff.consumeFinancialVoiceTranscript(),null,'Consumo unico')
assert.equal(handoff.stageFinancialVoiceTranscript(''),false)
assert.equal(handoff.stageFinancialVoiceTranscript('a'.repeat(450)),true)
assert.equal(handoff.consumeFinancialVoiceTranscript().length,400,'Limite de texto')
const pref=loadTs('src/lib/voicePreferences.ts')
assert.equal(pref.financialVoiceFabEnabled(),true)
pref.setFinancialVoiceFabEnabled(false)
assert.equal(pref.financialVoiceFabEnabled(),false)
pref.setFinancialVoiceFabEnabled(true)
assert.equal(pref.financialVoiceFabEnabled(),true)
assert.equal(events.length,2,'Mudancas visiveis no app sem recarregar')
delete globalThis.window
console.log('R412: voz nativa/browser, permissoes, privacidade, handoff de uso unico, controles e navegacao aprovados')
