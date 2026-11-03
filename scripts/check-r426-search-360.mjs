import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = path => fs.readFileSync(path, 'utf8')
let checks = 0
const ok = (label, condition) => { assert.ok(condition, label); checks++ }
const equal = (label, actual, expected) => { assert.deepEqual(actual, expected, label); checks++ }
function loadTS(path, requireMock = () => { throw Error('Import inesperado') }) {
  const code = read(path)
  const ast = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  equal(`Fonte TypeScript válida ${path}`, ast.parseDiagnostics.length, 0)
  const transpiled = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES5, module: ts.ModuleKind.CommonJS }
  })
  const exported = {}
  new Function('require', 'exports', transpiled.outputText)(requireMock, exported)
  return exported
}
const facet = loadTS('src/lib/financialSearchFacets.ts')
const item = (kind, transactionType) => ({ kind, transactionType })
const expense = item('transaction', 'expense')
const sangria = item('transaction', 'sangria')
const income = item('transaction', 'income')
const transfer = item('transaction', 'transfer')
for (const [input, expected] of [
  [expense, 'expense'], [sangria, 'expense'], [income, 'income'], [transfer, 'transfer'],
  [item('account'), 'account'], [item('card'), 'card'], [item('category'), 'category'],
  [item('loan'), 'loan'], [item('debt'), 'debt'], [item('financing'), 'financing'],
  [item('subscription'), 'subscription'], [item('goal'), 'goal'],
  [item('transaction', 'other'), null], [item('unknown'), null],
]) equal(`Classificar faceta ${input.kind}:${input.transactionType ?? ''}`, facet.financialSearchFacet(input), expected)
equal('Facetas vazias', facet.buildFinancialSearchFacets([]), [])
equal('Facetas agrupadas por quantidade, sem confundir sangria', facet.buildFinancialSearchFacets([
  expense, sangria, income, item('card'), item('card'), item('card'), transfer, item('unknown')
]), [{ id: 'card', count: 3 }, { id: 'expense', count: 2 }, { id: 'income', count: 1 }, { id: 'transfer', count: 1 }])
equal('Sem faceta para tipos desconhecidos', facet.buildFinancialSearchFacets([item('other'), item('transaction','other')]), [])
const one = facet.buildFinancialSearchFacets([item('card')])
equal('Uma faceta, contador correto', one, [{ id: 'card', count: 1 }])

const uid='12345678-abcd-1234-aaaa-123456789abc'
const allData={
  transactions:[
    { id:'expense-nubank',user_id:uid,context:'dfl',date:'2026-11-02',type:'expense',amount:123,description:'Gasolina',account_id:'nubank-account' },
    { id:'income-nubank',user_id:uid,context:'dfl',date:'2026-11-01',type:'income',amount:400,description:'Recebimento',account_id:'nubank-account' },
    { id:'transfer-nubank',user_id:uid,context:'dfl',date:'2026-11-02',type:'transfer',amount:60,description:'Transferência',account_id:'nubank-account' },
    { id:'other-context',user_id:uid,context:'personal',date:'2026-11-02',type:'expense',amount:999,description:'Mercado',account_id:'inter-account' },
  ],
  accounts:[
    { id:'nubank-account',user_id:uid,context:'dfl',name:'Nubank' },
    { id:'inter-account',user_id:uid,context:'personal',name:'Inter' }
  ],
  credit_cards:[
    { id:'nubank-card',user_id:uid,context:'dfl',name:'Nubank' },
    { id:'inter-card',user_id:uid,context:'personal',name:'Inter' }
  ],
  debts:[],loans:[],financings:[],subscriptions:[],goals:[],categories:[],contacts:[]
}
let databaseReads=0
const db=Object.fromEntries(Object.entries(allData).map(([name,rows])=>[name,{
  where(index){
    equal('IndexedDB sempre por usuario + contexto',index,'[user_id+context]')
    return { equals([uidParam,contextParam]) { return {async toArray(){
      databaseReads++
      return rows.filter(row=>row.user_id===uidParam&&row.context===contextParam)
    }} } }
  }
}]))
const search=loadTS('src/lib/globalSearch.ts',name=>{
  if(name==='@/lib/db')return {db}
  if(name==='@/lib/financialForecast')return {civilDate:value=>/^20\d{2}-\d{2}-\d{2}$/.test(String(value))}
  throw Error('Dependência inesperada da busca: '+name)
})
for(const [phrase,expected] of [
  ['abrir cartões do Nubank','card'], ['abrir contas do Nubank','account'],
  ['ver despesas do Nubank','expense'], ['ver receitas do Nubank','income'],
  ['ver transferências do Nubank','transfer'], ['abrir metas','goal'],
  ['abrir comprovantes','receipt'], ['Nubank',null],
  ['abrir cartões e contas',null], ['quanto gastei?',null],
]) equal('Preferência segura: '+phrase,search.preferredFinancialSearchKind(phrase),expected)
for(const text of ['abrir','buscar','abrir?']){
  databaseReads=0
  equal('Comando sem entidade não fabrica resultados '+text,await search.searchFinancialData(uid,'dfl',text),[])
  equal('Comando sem entidade não consulta tabelas '+text,databaseReads,0)
}
const orderedCards=await search.searchFinancialData(uid,'dfl','abrir cartões do Nubank')
equal('Cartão relevante vem antes de conta',orderedCards[0]?.id,'nubank-card')
ok('Outras correspondências não são apagadas',orderedCards.some(x=>x.id==='nubank-account'))
const orderedAccounts=await search.searchFinancialData(uid,'dfl','abrir contas do Nubank')
equal('Conta relevante vem primeiro',orderedAccounts[0]?.id,'nubank-account')
const orderedExpense=await search.searchFinancialData(uid,'dfl','ver despesas do Nubank')
equal('Despesa relevante vem primeiro',orderedExpense[0]?.id,'expense-nubank')
const orderedIncome=await search.searchFinancialData(uid,'dfl','ver receitas do Nubank')
equal('Receita relevante vem primeiro',orderedIncome[0]?.id,'income-nubank')
const withoutVerb=await search.searchFinancialData(uid,'dfl','Nubank')
ok('Busca direta continua funcionando',withoutVerb.some(x=>x.id==='nubank-card'))
equal('Pessoal não vê Nubank empresarial',(await search.searchFinancialData(uid,'personal','Nubank')).length,0)
equal('Empresa não vê Inter pessoal',(await search.searchFinancialData(uid,'dfl','Inter')).length,0)
equal('Outro usuário não encontra dados',(await search.searchFinancialData('other-user','dfl','Nubank')).length,0)
ok('Mês em linguagem natural preservado',(await search.searchFinancialData(uid,'dfl','novembro de 2026')).some(x=>x.id==='expense-nubank'))
equal('Abrir não vira abril',search.parseDateIntent('abrir',new Date(2026,10,3,12)),null)

const pagePath='src/app/(app)/search/page.tsx'
for (const p of [pagePath,'src/components/ContextualCommandBar.tsx','src/components/FinancialCommandHub.tsx']) {
  const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  equal('TSX sem erros de sintaxe '+p,ast.parseDiagnostics.length,0)
}
const page=read(pagePath)
const bar=read('src/components/ContextualCommandBar.tsx')
const hub=read('src/components/FinancialCommandHub.tsx')
const global=read('src/lib/globalSearch.ts')
const ci=read('.github/workflows/android-build.yml')
for(const [label,condition] of [
  ['Facetas originadas apenas dos itens resolvidos',page.includes("searchPhase === 'ready' && !loading")&&page.includes('buildFinancialSearchFacets(items)')],
  ['Classificador compartilhado com sheet',page.includes('return financialSearchFacet(item)')],
  ['Filtro rápido não cria outra fonte',page.includes('setActiveFilters(previous =>')],
  ['Filtro rápido tem estado acessível',page.includes('aria-pressed={selected}')],
  ['Todos mostra o total do lote',page.includes('Todos · {items.length}')],
  ['Contagem de filtros usa dados reais',page.includes('{facet.count}')],
  ['Não inventa mais de 40 resultados',page.includes("items.length >= 40 ? ' · refine para encontrar mais'")],
  ['Erro de filtros tem recuperação',page.includes('Limpar filtros e mostrar resultados')],
  ['Troca de contexto limpa filtros',page.includes('useEffect(() => { setActiveFilters([]) }, [user?.id, context])')],
  ['Teclado Enter recolhe sem gravar',page.includes("event.key === 'Enter'")&&page.includes('inputRef.current?.blur()')],
  ['Escape limpa apenas a busca',page.includes("event.key === 'Escape') setQuery('')")],
  ['Antigo botão de filtros continua',page.includes('setFiltersOpen(true)')],
  ['R424 protege resultados por chave',page.includes("if (searchPhase !== 'ready') return []")],
  ['R411 cadastro completo permanece',page.includes('smartDraftUrl(smartDraft)')],
  ['R418 navegação permanece',page.includes('resolveFinancialNavigationIntent(trimmedQuery)')],
  ['R420 central continua',page.includes('<FinancialCommandHub')],
  ['Atalho preserva origem',bar.includes('stageCommandHubScope(scope, false)')],
  ['Atalho exige handoff de consulta válido',bar.includes("if (!stageContextualSearchQuery(item.value)) return")],
  ['Voz de um toque permanece',bar.includes('void startVoice()')],
  ['Feedback de favoritos é acessível',hub.includes('aria-live="polite"')&&hub.includes('{favoriteFeedback}')],
  ['Favoritos continuam sem dados financeiros',!hub.includes('db.transactions')&&!hub.includes('supabase')],
  ['Consulta curta para antes de abrir IndexedDB',global.includes('if (!dateIntent && tokens.length === 0) return []')],
  ['Sem gravações financeiras no patch',!global.includes('supabase')&&!global.includes('fetch(')],
  ['R426 tem gate no CI',ci.includes('node scripts/check-r426-search-360.mjs')]
])ok(label,condition)
for(const version of ['417','418','419','420','421','422','423','424','425'])
  ok(`CI preserva R${version}`,ci.includes(`node scripts/check-r${version}-`))
console.log(`R426: ${checks} verificações de relevância, filtros vivos, privacidade, PF/PJ, teclado, comandos e CI aprovadas`)
