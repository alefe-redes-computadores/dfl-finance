import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'
const read = name => fs.readFileSync(name,'utf8')
function load(file){
 const transpiled=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 const exports={};new Function('exports',transpiled)(exports);return exports
}
const { CONTEXTUAL_COMMAND, safeContextualRoute } = load('src/lib/contextualCommand.ts')
let tested=0
function check(test,label){assert.ok(test,label);tested++}
for(const scope of ['home','transactions','analysis','cards']){
 const data=CONTEXTUAL_COMMAND[scope]
 check(data.examples.length>=3,scope+' examples')
 check(data.shortcuts.length>=2,scope+' shortcuts')
 for(const item of data.shortcuts)check(Boolean(safeContextualRoute(item)),scope+': '+item.label)
}
check(safeContextualRoute({label:'X',kind:'route',value:'https://unknown.test'})===null,'routes allowlisted')
check(safeContextualRoute({label:'X',kind:'search',value:'mercado'})==='/search','search destination')
const keys=new Map()
globalThis.window={sessionStorage:{getItem:k=>keys.get(k)||null,setItem:(k,v)=>keys.set(k,v),removeItem:k=>keys.delete(k)}}
const handoff=load('src/lib/contextualSearchHandoff.ts')
check(handoff.stageContextualSearchQuery('  mercado  '),'query staged')
check(handoff.consumeContextualSearchQuery()==='mercado','query consumed')
check(handoff.consumeContextualSearchQuery()===null,'single use')
check(!handoff.stageContextualSearchQuery('   '),'reject blank')
check(handoff.stageContextualSearchQuery('x'.repeat(180)),'bounded input')
check(handoff.consumeContextualSearchQuery().length===120,'bounded output')
delete globalThis.window
for (const file of [
 'src/components/ContextualCommandBar.tsx',
 'src/lib/contextualCommand.ts',
 'src/lib/contextualSearchHandoff.ts',
 'src/app/(app)/home/page.tsx',
 'src/app/(app)/transactions/page.tsx',
 'src/app/(app)/analysis/page.tsx',
 'src/app/(app)/cards/page.tsx',
 'src/app/(app)/search/page.tsx',
]){
 const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)
 check(source.parseDiagnostics.length===0,file+' syntax')
}
const bar=read('src/components/ContextualCommandBar.tsx')
const search=read('src/app/(app)/search/page.tsx')
check(bar.includes('prefers-reduced-motion: reduce'),'reduced motion observed')
check(bar.includes('router.push(\'/search\')'),'existing search navigated')
check(search.includes('consumeContextualSearchQuery()'),'handoff integrated')
check(search.includes('consumeFinancialVoiceTranscript()'),'voice preserved')
check(search.includes('interpretFinancialInput(trimmedQuery)'),'financial draft preserved')
check(read('src/components/BottomNav.tsx').includes("navigateSafely('/transactions/new')"),'central plus preserved')
check(read('src/app/globals.css').includes('@keyframes dfl-command-trail'),'glow present')
check(read('.github/workflows/android-build.yml').includes('node scripts/check-r417-contextual-command.mjs'),'CI protected')
console.log(`R417: ${tested} verificacoes aprovadas; sem rede, escrita financeira ou banco.`)
