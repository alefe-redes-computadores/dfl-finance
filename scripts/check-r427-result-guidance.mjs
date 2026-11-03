import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
let checks=0
function ok(label,value){assert.ok(value,label);checks++}
function eq(label,actual,expected){assert.deepEqual(actual,expected,label);checks++}
function load(file){
  const code=read(file)
  const ast=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
  eq(`TS syntax ${file}`,ast.parseDiagnostics.length,0)
  const result=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.CommonJS},reportDiagnostics:true})
  eq(`TS transpile ${file}`,(result.diagnostics||[]).length,0)
  const exported={}
  new Function('exports',result.outputText)(exported)
  return exported
}
const engine=load('src/lib/financialSearchGuidance.ts')
const hub=load('src/lib/financialCommandHub.ts')
const decide=engine.buildFinancialResultGuidance
const card={id:'c-1',kind:'card',href:'/cards/details?id=c-1',title:'Cartão A'}
const account={id:'a-1',kind:'account',href:'/accounts/details?id=a-1',title:'Conta A'}
const expense={id:'t-1',kind:'transaction',transactionType:'expense',href:'/transactions/details?id=t-1',title:'Despesa A'}
const invalid={id:'c-1',kind:'card',href:'https://example.com',title:'Externo'}
const other={id:'c-2',kind:'category',href:'/categories',title:'Categoria A'}
const facets=[{id:'card',count:1},{id:'account',count:1},{id:'expense',count:1}]
eq('Nenhum item nao fabrica insight',decide([],[],null,[]),null)
eq('Resultado unico verificavel abre somente por toque',decide([card],[{id:'card',count:1}],null,[])?.kind,'open')
eq('Resultado unico aponta item conhecido',decide([card],[{id:'card',count:1}],null,[])?.item,card)
eq('Nao recomenda abrir url externa',decide([invalid],[{id:'card',count:1}],null,[]),null)
eq('Nao recomenda abrir rota generica como detalhe',decide([other],[{id:'category',count:1}],null,[]),null)
eq('Nao confunde kind com prefixo da rota',decide([{...card,href:account.href}],[{id:'card',count:1}],null,[]),null)
eq('Protege protocolo-relative',decide([{...card,href:'//example.com'}],[{id:'card',count:1}],null,[]),null)
eq('Protege identificador diferente',decide([{...card,id:'c-2'}],[{id:'card',count:1}],null,[]),null)
eq('Permite id com parametros codificados',decide([{...card,id:'a&b',href:'/cards/details?id=a%26b'}],[{id:'card',count:1}],null,[])?.kind,'open')
eq('Nao salva valores no detalhe sugerido',decide([expense],[{id:'expense',count:1}],null,[])?.detail.includes('R$'),false)
eq('Sugestao de refinamento real',decide([card,account,expense],facets,'card',[])?.kind,'refine')
eq('Apenas uma categoria validada',decide([card,account,expense],facets,'card',[])?.facet,'card')
eq('Conta deve permanecer distinta',decide([card,account,expense],facets,'account',[])?.facet,'account')
eq('Despesa deve permanecer distinta',decide([card,account,expense],facets,'expense',[])?.facet,'expense')
eq('Texto mostra que contagem e local',decide([card,account,expense],facets,'card',[])?.detail.includes('Neste lote'),true)
eq('Nao admite faceta receipt nao renderizada',decide([card,account,expense],facets,'receipt',[]),null)
eq('Sem sugestao com preferencia ausente',decide([card,account,expense],facets,null,[]),null)
eq('Sem sugestao se tipo nao encontrado',decide([card,account,expense],facets,'goal',[]),null)
eq('Sem sugestao se todos ja sao cartoes',decide([card,{...card,id:'c-2',href:'/cards/details?id=c-2'}],[{id:'card',count:2}],'card',[]),null)
eq('Filtro ativo nao compete com sugestao',decide([card,account,expense],facets,'card',['account']),null)
eq('Multiplos filtros nao competem',decide([card,account,expense],facets,'card',['account','card']),null)
eq('Um resultado com filtro ativo nao sugere abrir',decide([card],[{id:'card',count:1}],null,['card']),null)
eq('Nomes financeiros nao entram no detalhe da sugestao',decide([card,account,expense],facets,'card',[])?.detail.includes('Cartão A'),false)
const favorites=['reports','planning','goals','new-expense','accounts']
const contextual=hub.suggestedHubActions('cards',favorites,[])
ok('Central mostra contexto de cartoes mesmo com favoritos antigos',contextual.some(a=>a.id==='cards'))
ok('Pelo menos uma acao contextual para cartoes',contextual.filter(a=>a.scopes.includes('cards')).length>=1)
ok('Todos os cinco favoritos continuam presentes',favorites.every(id=>contextual.some(a=>a.id===id)))
eq('Central continua limitada a seis',contextual.length,6)
eq('Sem duplicacao de atalhos',new Set(contextual.map(a=>a.id)).size,contextual.length)
eq('Primeira acao de cartoes e cartoes sem favoritos',hub.suggestedHubActions('cards',[],[])[0]?.id,'cards')
ok('Comando analises conserva relatórios',hub.suggestedHubActions('analysis',[],[]).some(a=>a.id==='reports'))
eq('Busca sem contexto conserva funcionamento',hub.suggestedHubActions('search',[],[]).length,6)
for(const file of ['src/app/(app)/search/page.tsx','src/components/FinancialResultGuide.tsx','src/components/FinancialCommandHub.tsx']){
 const ast=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 eq(`TSX syntax ${file}`,ast.parseDiagnostics.length,0)
}
const search=read('src/app/(app)/search/page.tsx')
const ui=read('src/components/FinancialResultGuide.tsx')
const hubui=read('src/components/FinancialCommandHub.tsx')
const engineCode=read('src/lib/financialSearchGuidance.ts')
const workflow=read('.github/workflows/android-build.yml')
for(const [label,condition] of [
 ['R427 orientacao usa somente resultados resolvidos',search.includes("if (searchPhase !== 'ready' || loading || smartDraft || navigationIntent || !trimmedQuery || inputFocused) return null")],
 ['Filtro e preferencia do usuario passam ao motor puro',search.includes('buildFinancialResultGuidance(items, resultFacets, preferredFinancialSearchKind(trimmedQuery), activeFilters)')],
 ['Somente renderiza quando ha insight',search.includes('{resultGuidance && (')],
 ['Abertura so reutiliza caminho de resultados',search.includes('onOpen={openResult}')],
 ['Refinamento so reutiliza filtro atual',search.includes('onRefine={chooseQuickFacet}')],
 ['R426 facetas preservadas',search.includes('buildFinancialSearchFacets(items)')],
 ['R424 guarda de isolamento preservada',search.includes("if (searchPhase !== 'ready') return []")],
 ['R411 formulario completo preservado',search.includes('smartDraftUrl(smartDraft)')],
 ['R412 voz preservada',search.includes('consumeFinancialVoiceTranscript()')],
 ['R418 navegacao preservada',search.includes('resolveFinancialNavigationIntent(trimmedQuery)')],
 ['R420 favoritos preservados',search.includes('<FinancialCommandHub')],
 ['UI nao altera dados na montagem',!ui.includes('useEffect')&&!ui.includes('db.transactions')&&!ui.includes('fetch(')],
 ['UI possui rotulo acessivel',ui.includes('aria-label="Orientação contextual dos resultados"')],
 ['UI usa clique explicito',ui.includes('onClick={() => guidance.kind')],
 ['UI informa origem de dados',ui.includes('Com base somente nos resultados locais')],
 ['UI tem estado focus-visible',ui.includes('focus-visible:outline')],
 ['UI preserva conteudo compacto',ui.includes('px-3.5 py-3')],
 ['Historico recente atualiza ao clicar',hubui.includes('setRecent(hubRecents(userId, context))')],
 ['Favoritos continuam por usuario',hubui.includes('hubFavorites(userId, context)')],
 ['Novo motor nao possui rede nem persistencia',!engineCode.includes('fetch(')&&!engineCode.includes('supabase')&&!engineCode.includes('localStorage')],
 ['Nenhuma query sensivel em URL',!ui.includes('location.href')],
 ['CI inclui R427',workflow.includes('node scripts/check-r427-result-guidance.mjs')],
]) ok(label,condition)
for(const v of ['417','418','419','420','421','422','423','424','425','426'])ok(`CI preserva R${v}`,workflow.includes(`node scripts/check-r${v}-`))
console.log(`R427: ${checks} contratos de orientacao, isolamento, filtros, favoritos, privacidade e CI aprovados`)
