import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const file='src/lib/financialSearchContinuity.ts'
const code=read(file)
const parsed=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
assert.equal(parsed.parseDiagnostics.length,0,'R424: TypeScript do gate de busca')
const transpiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.CommonJS}}).outputText
const out={}
new Function('exports',transpiled)(out)
const {financialSearchRequestKey:key,financialSearchPhase:phase}=out
const u1='12345678-1234-1234-1234-123456789abc'
const u2='87654321-4321-4321-4321-cba987654321'
const business=key(u1,'dfl','mercado',0)
const personal=key(u1,'personal','mercado',0)
const userOther=key(u2,'dfl','mercado',0)
const changed=key(u1,'dfl','gasolina',0)
const retry=key(u1,'dfl','mercado',1)
let checks=0
const ok=(what,condition)=>{assert.ok(condition,what);checks++}
const eq=(what,a,b)=>{assert.equal(a,b,what);checks++}
ok('Contexto nao mistura resultados',business!==personal)
ok('Usuario nao mistura resultados',business!==userOther)
ok('Texto nao mistura resultados',business!==changed)
ok('Retry nao reutiliza resultados',business!==retry)
eq('Espacos externos normalizados',key(u1,'dfl',' mercado ',0),business)
ok('Tokens com separadores nao colidem',key(u1,'dfl','A|B',1)!==key(u1,'dfl','A',1))
eq('Sem usuario sem consulta',key(null,'dfl','mercado',0),'')
eq('Sem texto sem consulta',key(u1,'dfl','  ',0),'')
eq('Tentativa negativa proibida',key(u1,'dfl','mercado',-1),'')
eq('Tentativa nao inteira proibida',key(u1,'dfl','mercado',1.5),'')
eq('Contexto desconhecido proibido',key(u1,'x','mercado',0),'')
eq('Sem chave nao mostra dados',phase('',business,'',false),'idle')
eq('Resultado do mesmo contexto',phase(business,business,'',false),'ready')
eq('Resultado de empresa nao vaza no pessoal',phase(personal,business,'',false),'loading')
eq('Resultado de outro usuario nao vaza',phase(userOther,business,'',false),'loading')
eq('Resultado de outra consulta nao vaza',phase(changed,business,'',false),'loading')
eq('Resultado de outra tentativa nao vaza',phase(retry,business,'',false),'loading')
eq('Busca carregando tem prioridade',phase(business,business,'',true),'loading')
eq('Erro valido da tentativa atual',phase(business,'',business,false),'error')
eq('Erro antigo nao contamina nova consulta',phase(changed,'',business,false),'loading')
eq('Erro antigo nao contamina novo usuario',phase(userOther,'',business,false),'loading')
eq('Erro antigo nao contamina outro contexto',phase(personal,'',business,false),'loading')
eq('Pesquisa resolvida sem itens pode estar pronta',phase(retry,retry,'',false),'ready')
ok('Modulo puro, sem persistence ou acesso a rede',!/(fetch\(|supabase|localStorage|sessionStorage|\.put\(|\.add\()/.test(code))
const screenPath='src/app/(app)/search/page.tsx'
const screen=read(screenPath)
const screenAST=ts.createSourceFile(screenPath,screen,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
eq('Sintaxe da busca preservada',screenAST.parseDiagnostics.length,0)
for(const [label,condition] of [
  ['Isolamento por usuario e contexto',screen.includes("financialSearchRequestKey(user?.id, context as 'dfl' | 'personal', trimmedQuery, searchAttempt)")],
  ['Resultado marcado por chave',screen.includes('setResolvedSearchKey(requestKey)')],
  ['Erro marcado por chave',screen.includes('setFailedSearchKey(requestKey)')],
  ['Busca valida somente se fase ready',screen.includes("if (searchPhase !== 'ready') return []")],
  ['Erro antigo nao vira mensagem da nova consulta',screen.includes("searchError && searchPhase === 'error'")],
  ['Debounce nao e confundido com busca vazia',screen.includes("searchPhase === 'loading' ? (")],
  ['Leitura acessivel tem fase de busca',screen.includes("searchPhase === 'loading' && trimmedQuery.length >= 2")],
  ['A busca antiga continua com debounce',screen.includes('}, 180)')],
  ['R411 continua com cadastro completo',screen.includes('smartDraftUrl(smartDraft)')],
  ['R412 voz mantida',screen.includes('consumeFinancialVoiceTranscript()')],
  ['R418 navegacao mantida',screen.includes('resolveFinancialNavigationIntent(trimmedQuery)')],
  ['R420 central mantida',screen.includes('<FinancialCommandHub')],
  ['R423 teclado mantido',screen.includes('!trimmedQuery && !inputFocused && (')],
]) ok(label,condition)
const ci=read('.github/workflows/android-build.yml')
ok('CI inclui R424',ci.includes('node scripts/check-r424-search-continuity.mjs'))
for(const version of ['417','418','419','420','421','422','423'])ok('CI inclui R'+version,ci.includes('node scripts/check-r'+version+'-'))
ok('Nenhuma API/DB no novo gate',!/(fetch\(|supabase|indexedDB|db\.transactions)/.test(code))
console.log(`R424: ${checks} contratos de isolamento PF/PJ, busca, retries, erros, voz e CI aprovados.`)
