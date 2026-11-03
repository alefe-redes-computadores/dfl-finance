import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const name='src/lib/financialCommandHub.ts'
const source=fs.readFileSync(name,'utf8')
const ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
assert.equal(ast.parseDiagnostics.length,0)
assert.ok(source.includes('Array.from(new Set('), 'R420-R2: Set deve usar Array.from para target ES5')
assert.ok(!source.includes('[...new Set('), 'R420-R2: proibir spread sobre Set')
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText
const exports={}
new Function('exports',js)(exports)
const hub=exports
const session=new Map(),local=new Map()
const storage=map=>({getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)})
globalThis.window={sessionStorage:storage(session),localStorage:storage(local)}
const user='12345678-abcd-1234-aaaa-123456789abc'
let count=0
function ok(result,label){assert.ok(result,label);count++}
const f=()=>hub.hubFavorites(user,'dfl')
const r=()=>hub.hubRecents(user,'dfl')
ok(hub.hubAction('cards')?.href==='/cards','Catalog card')
ok(hub.hubAction('unknown')===null,'No unknown action')
ok(hub.suggestedHubActions('analysis',[],[]).some(x=>x.id==='reports'),'Contextual suggestions')
ok(hub.suggestedHubActions('cards',[],[])[0]?.id==='cards','Card first')
ok(f().length===0&&r().length===0,'Empty initially')
ok(hub.rememberHubAction(user,'dfl','cards')===true,'Remember safe ID')
ok(r()[0]==='cards','Recent ID stored')
ok(hub.rememberHubAction(user,'dfl','NOPE')===false,'Reject unknown')
ok(r().length===1,'Reject unknown without modification')
ok(hub.rememberKnownHubRoute(user,'dfl','/transactions/new?intent=smart&description=private')===false,'No financial draft history')
ok(hub.rememberKnownHubRoute(user,'dfl','https://example.com')===false,'No external URL history')
ok(hub.rememberKnownHubRoute(user,'dfl','/accounts')===true,'Known route recorded')
ok(r()[0]==='accounts','Last route first')
ok(hub.hubRecents(user,'personal').length===0,'Context isolated')
ok(hub.hubRecents('another-user','dfl').length===0,'User isolated')
ok(hub.toggleHubFavorite(user,'dfl','cards')[0]==='cards','Favorite stored')
ok(f().length===1,'Favorite reads back')
ok(hub.toggleHubFavorite(user,'dfl','cards').length===0,'Unfavorite')
ok(hub.toggleHubFavorite(user,'dfl','INVALID').length===0,'Unrecognized favorite rejected')
for(const x of ['cards','accounts','analysis','new-expense','new-income','transfer','reports']) hub.toggleHubFavorite(user,'dfl',x)
ok(f().length===5,'Favorite max 5')
for(const x of ['cards','accounts','analysis','reports','planning','projections','new-expense']) hub.rememberHubAction(user,'dfl',x)
ok(r().length===5,'Recents max 5')
ok(new Set(hub.suggestedHubActions('home',f(),r()).map(x=>x.id)).size===6,'No duplicate suggestions')
hub.clearHubRecents(user,'dfl')
ok(r().length===0,'Clear recents')
ok(f().length===5,'Clear recents keeps favorites')
ok(hub.stageCommandHubScope('cards',true)===true,'Stage voice source')
ok(hub.consumeCommandHubScope()?.scope==='cards','Consumed scope')
ok(hub.consumeCommandHubScope()===null,'One-time scope')
ok(hub.stageCommandHubScope('NOPE')===false,'Reject scope')
session.set('dfl.finance.hub.scope.v420',JSON.stringify({scope:'home',voice:false,at:Date.now()-60_000}))
ok(hub.consumeCommandHubScope()===null,'Expire stale scope')
ok(!JSON.stringify([...session,...local]).includes('private'),'No query stored')
for(const a of hub.COMMAND_HUB_ACTIONS) {
  ok(a.href.startsWith('/')&&!a.href.startsWith('//')&&!a.href.includes('javascript:')&&!a.href.includes('intent=smart'),'Route allowlist '+a.id)
}
delete globalThis.window
ok(hub.hubFavorites(user,'dfl').length===0,'SSR safe favorites')
ok(hub.hubRecents(user,'dfl').length===0,'SSR safe recents')
ok(hub.stageCommandHubScope('home')===false,'SSR safe handoff')
ok(!source.includes('fetch(')&&!source.includes('supabase')&&!source.includes('db.transactions'),'No remote or database in state')
const files=['src/components/FinancialCommandHub.tsx','src/components/ContextualCommandBar.tsx','src/app/(app)/search/page.tsx']
for(const p of files){const code=fs.readFileSync(p,'utf8');const ast=ts.createSourceFile(p,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);ok(ast.parseDiagnostics.length===0,`TSX ${p}`)}
const screen=fs.readFileSync('src/app/(app)/search/page.tsx','utf8')
const bar=fs.readFileSync('src/components/ContextualCommandBar.tsx','utf8')
const ui=fs.readFileSync('src/components/FinancialCommandHub.tsx','utf8')
ok(screen.includes('<FinancialCommandHub')&&screen.includes('consumeCommandHubScope()'),'Unified search screen')
ok(screen.includes('consumeFinancialVoiceTranscript()')&&screen.includes('consumeContextualSearchQuery()'),'Voice and contextual handoff preserved')
ok(screen.includes('interpretFinancialInput(trimmedQuery)')&&screen.includes('smartDraftUrl(smartDraft)'),'Financial draft unchanged')
ok(screen.includes('resolveFinancialNavigationIntent(trimmedQuery)'),'R418 navigation preserved')
ok(screen.includes('rememberKnownHubRoute('),'Record only known actions')
ok(bar.includes('stageCommandHubScope(scope, true)')&&bar.includes('stageCommandHubScope(scope, false)'),'Context survives navigation')
ok(ui.includes('toggleHubFavorite')&&ui.includes('clearHubRecents'),'Favorites and clearing wired')
ok(ui.includes('aria-pressed={favorite}')&&ui.includes('aria-label="Limpar ações recentes"'),'Accessibility')
ok(!ui.includes('fetch(')&&!ui.includes('supabase')&&!ui.includes('.put('),'No financial writes')
ok(fs.readFileSync('src/components/BottomNav.tsx','utf8').includes("navigateSafely('/transactions/new')"),'Plus preserved')
ok(fs.readFileSync('.github/workflows/android-build.yml','utf8').includes('node scripts/check-r420-unified-command.mjs'),'CI protection')
console.log(`R420: ${count} verificacoes de favoritos, historico, voz, navegacao, privacidade e integracao aprovadas.`)
