import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = file => fs.readFileSync(file, 'utf8')
const barPath = 'src/components/ContextualCommandBar.tsx'
const hubPath = 'src/components/FinancialCommandHub.tsx'
const searchPath = 'src/app/(app)/search/page.tsx'
const files = [barPath, hubPath, searchPath]
let count = 0
function check(label, condition) { assert.ok(condition, label); count++ }
for (const file of files) {
  const ast = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  check('TSX parse: ' + file, ast.parseDiagnostics.length === 0)
}
const bar = read(barPath)
const hub = read(hubPath)
const search = read(searchPath)
const css = read('src/app/globals.css')
const ci = read('.github/workflows/android-build.yml')
const voiceHandler = bar.match(/function openVoice\(\) \{([\s\S]*?)\n  \}/)?.[1] || ''
check('Voz começa no clique', voiceHandler.includes('void startVoice()'))
check('Sem navegação antes de ouvir', !voiceHandler.includes('router.push'))
check('Voz permite parar', voiceHandler.includes("voiceStatus === 'listening'") && voiceHandler.includes('cancelVoice()'))
check('Voz não dispara processamento duplicado', voiceHandler.includes("voiceStatus === 'processing'"))
check('Hook original reaproveitado', bar.includes("from '@/hooks/useFinancialSpeech'"))
check('Sem segundo motor de reconhecimento', !bar.includes('SpeechRecognition.') && !bar.includes('webkitSpeechRecognition'))
check('Transcrição efêmera reaproveitada', bar.includes('stageFinancialVoiceTranscript(voiceTranscript)'))
check('Handoff com contexto preservado', bar.includes('stageCommandHubScope(scope, true)'))
check('Rota de voz encaminha à busca', bar.includes("router.push('/search?voice=1')"))
check('Falha da voz tem alternativa para digitar', bar.includes('voiceNotice &&') && bar.includes('>Digitar</button>'))
check('Estado de escuta acessível', bar.includes("aria-pressed={voiceStatus === 'listening'}"))
check('Movimento respeita usuário', bar.includes('motion-safe:animate-pulse'))
check('Entrada de busca original preservada', bar.includes('stageCommandHubScope(scope, false)') && bar.includes("router.push('/search')"))
check('Ações da central mantidas', hub.includes('suggestedHubActions(scope, favorites, recent)'))
check('Três sugestões no modo compacto', hub.includes('actions.slice(0, 3)'))
check('Expandir ações de forma controlada', hub.includes('setExpanded(value => !value)'))
check('Botão acessível para expandir', hub.includes('aria-expanded={expanded}') && hub.includes('aria-controls="dfl-hub-action-list"'))
check('Mudança de contexto recolhe central', hub.includes('setExpanded(false) }, [scope, context, userId]'))
check('Favoritos preservados', hub.includes('toggleHubFavorite(') && hub.includes('aria-pressed={favorite}'))
check('Recentes continuam limitados e limpáveis', hub.includes('clearHubRecents('))
check('Busca rastreia a consulta resolvida', search.includes('const [resolvedQuery, setResolvedQuery]'))
check('Resultados antigos nunca entram na lista da nova consulta', search.includes('if (loading || trimmedQuery !== resolvedQuery) return []'))
check('Sucesso marca consulta correspondente', search.includes('setResolvedQuery(trimmedQuery)'))
check('Falha limpa a consulta resolvida', search.includes("setResolvedQuery('')"))
check('Busca usa debounce existente', search.includes('}, 180)'))
check('R411 rascunho com revisão preservado', search.includes('smartDraftUrl(smartDraft)'))
check('R418 navegação preservada', search.includes('resolveFinancialNavigationIntent(trimmedQuery)'))
check('R420 favoritos preservados', search.includes('<FinancialCommandHub'))
check('Pausa de brilho em segundo plano', bar.includes("'dfl-command-frame-paused'") && css.includes('.dfl-command-frame-paused::before { animation-play-state: paused; }'))
check('Movimento reduzido continua protegido', css.includes('@media (prefers-reduced-motion: reduce)'))
check('CI executa R422', ci.includes('node scripts/check-r422-voice-density-search.mjs'))
check('CI conserva R421', ci.includes('node scripts/check-r421-contextual-stability.mjs'))
check('CI conserva R420', ci.includes('node scripts/check-r420-unified-command.mjs'))
check('Preservação do botão +', read('src/components/BottomNav.tsx').includes("navigateSafely('/transactions/new')"))
check('Sem gravações no componente da barra', !bar.includes('db.transactions') && !bar.includes('supabase') && !bar.includes('fetch('))
check('Sem gravações na central', !hub.includes('db.transactions') && !hub.includes('supabase') && !hub.includes('fetch('))
console.log(`R422: ${count} contratos de voz, busca, densidade, acessibilidade, privacidade e CI aprovados.`)
