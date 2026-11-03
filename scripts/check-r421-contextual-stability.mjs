import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = file => fs.readFileSync(file, 'utf8')
const helperPath = 'src/lib/contextualInsightPresentation.ts'
const helper = read(helperPath)
const source = ts.createSourceFile(helperPath, helper, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
assert.equal(source.parseDiagnostics.length, 0, 'Política R421 deve ser TS válido')
const js = ts.transpileModule(helper, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
new Function('exports', js)(exports)
const { planContextualInsight: plan } = exports

const insight = (id, detail='evidência de teste') => ({ id, title:'Observação', detail, href:'/transactions', basis:'completed' })
const a = insight('a')
const b = insight('b')
const stamp = 1783190000000
const base = { candidates:[a,b], current:null, previousId:null, shownAt:undefined, dismissedUntil:undefined, nowMs:stamp,
  foreground:true, showCooldownMs:3*60_000, repeatCooldownMs:20*60_000 }
let count = 0
function check(label, actual, expected){ assert.deepEqual(actual, expected, label); count++ }
check('Primeira sugestão aparece',plan(base),{kind:'schedule',insight:a})
check('Alterna quando já mostrou A',plan({...base,previousId:'a'}),{kind:'schedule',insight:b})
check('Mantém A em atualização',plan({...base,current:a,previousId:'a',shownAt:stamp-15_000}),{kind:'keep',insight:a})
const aUpdated = insight('a','texto atualizado')
check('Atualiza sem sumir',plan({...base,candidates:[aUpdated,b],current:a}),{kind:'keep',insight:aUpdated})
check('Não mantém insight sem evidência',plan({...base,candidates:[],current:a}),{kind:'wait',insight:null})
check('Não mostra insight se documento está oculto',plan({...base,foreground:false}),{kind:'wait',insight:null})
check('Se já está visível, mantém no fundo',plan({...base,current:a,foreground:false}),{kind:'keep',insight:a})
check('Respeita dispensa',plan({...base,dismissedUntil:stamp+30_000}),{kind:'wait',insight:null})
check('Respeita cooldown de reentrada',plan({...base,shownAt:stamp-1_000}),{kind:'wait',insight:null})
check('Repete único candidato só depois do cooldown maior',plan({...base,candidates:[a],previousId:'a',shownAt:stamp-4*60_000}),{kind:'wait',insight:null})
check('Exibe único candidato após cooldown',plan({...base,candidates:[a],previousId:'a',shownAt:stamp-21*60_000}),{kind:'schedule',insight:a})
check('Hora inválida é bloqueada',plan({...base,nowMs:NaN}),{kind:'wait',insight:null})
check('Lista sem candidatos permanece quieta',plan({...base,candidates:[]}),{kind:'wait',insight:null})

const cardPath = 'src/components/ContextualInsightCard.tsx'
const barPath = 'src/components/ContextualCommandBar.tsx'
const card = read(cardPath)
const bar = read(barPath)
const ci = read('.github/workflows/android-build.yml')
for (const file of [cardPath, barPath]) {
  const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  assert.equal(ast.parseDiagnostics.length,0,`${file}: TSX inválido`)
  count++
}
for (const [name,truth] of [
  ['Motor puro e sem rede',!helper.includes('fetch(')&&!helper.includes('supabase')&&!helper.includes('localStorage')],
  ['Card usa política testada',card.includes('planContextualInsight({')],
  ['Card persiste visibilidade por chave',card.includes('visible?.key === key') && card.includes('kind === \'keep\'')],
  ['Dia avança após a meia-noite',card.includes('setInterval(refreshClock') && card.includes('previous.getDate()')],
  ['Retorno ao primeiro plano atualiza data',card.includes("window.addEventListener('focus', refreshClock)")],
  ['Insights segregados por usuário e contexto',card.includes('storageKey(scope, effectiveContext, user.id)')],
  ['Consulta local limitada',card.includes("where('[user_id+context+date]')")],
  ['Não duplica gravação financeira',!card.includes('supabase')&&!card.includes('fetch(')&&!card.includes('.put(')&&!card.includes('.add(')],
  ['Dispensa mantida',card.includes('Dispensar insight por 20 minutos')],
  ['Pausa texto animado em segundo plano',bar.includes('!animate || !shown || !pageActive') && bar.includes("document.addEventListener('visibilitychange', onVisibility)")],
  ['Entrada de voz mantida',bar.includes('stageCommandHubScope(scope, true)')],
  ['Busca existente mantida',bar.includes("router.push('/search')")],
  ['CI protege R421',ci.includes('node scripts/check-r421-contextual-stability.mjs')],
  ['CI mantém R420',ci.includes('node scripts/check-r420-unified-command.mjs')],
]) {assert.ok(truth,name); count++}
console.log(`R421: ${count} validações de estabilidade, relógio local, UX, privacidade e CI aprovadas.`)
