import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const file='supabase/functions/_shared/whatsappAudioIngress.ts'
const source=fs.readFileSync(file,'utf8')
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const exports={}
new Function('exports',compiled)(exports)
const {audioFeatureEnabled,inspectWhatsAppAudio,safeAudioTranscript,transcribeWhatsAppAudio}=exports
let tested=0
function check(condition,message){assert.ok(condition,message);tested++}
check(!audioFeatureEnabled(undefined),'OFF por padrao')
check(!audioFeatureEnabled('true'),'Nao ativa por true')
check(audioFeatureEnabled('enabled'),'Flag explicita')
const audio={audioMessage:{mimetype:'audio/ogg; codecs=opus',seconds:12,fileLength:1024}}
check(inspectWhatsAppAudio(audio)?.mime==='audio/ogg','opus aceito')
check(!inspectWhatsAppAudio({audioMessage:{mimetype:'video/mp4',seconds:12,fileLength:1024}}),'video proibido')
check(!inspectWhatsAppAudio({audioMessage:{mimetype:'audio/ogg',seconds:91,fileLength:1024}}),'duracao limite')
check(!inspectWhatsAppAudio({audioMessage:{mimetype:'audio/ogg',seconds:12,fileLength:1500001}}),'tamanho limite')
check(safeAudioTranscript('  Paguei 28 reais  ') === 'Paguei 28 reais','texto normalizado')
check(safeAudioTranscript('<script>')===null,'conteudo marcado bloqueado')
check(!safeAudioTranscript(' '.repeat(15)),'vazio bloqueado')
const hook=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const ci=fs.readFileSync('.github/workflows/android-build.yml','utf8')
check(hook.includes('DFL_WA_AUDIO_ROLLOUT'),'rollout server')
check(hook.includes('audioFeatureEnabled('),'gate')
check(hook.includes('if(!auditId)return new Response'), 'dedupe antes transcrever')
check(hook.includes('Nenhuma transação foi criada.'),'sem escrita por audio')
check(hook.includes('return new Response(\'OK\');\n}\nif(!text){'),'sem queda no fluxo texto')
check(ci.includes('node scripts/check-r413-whatsapp-audio.mjs'),'gate CI')
check(!source.includes('service_role'),'sem credencial em cliente')
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
check(ast.parseDiagnostics.length===0,'AST compartilhado')
const hAst=ts.createSourceFile('webhook.ts',hook,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
check(hAst.parseDiagnostics.length===0,'AST webhook')
console.log(`R413: ${tested} contratos aprovados`)
