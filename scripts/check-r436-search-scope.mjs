import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
let passed=0
const eq=(msg,a,b)=>{assert.deepEqual(a,b,msg);passed++}
const ok=(msg,v)=>{assert.ok(v,msg);passed++}
const source=fs.readFileSync('src/lib/globalSearch.ts','utf8')
const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES5},reportDiagnostics:true})
eq('Transpilacao ES5',transpiled.diagnostics?.length??0,0)
const ast=ts.createSourceFile('src/lib/globalSearch.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
eq('Sintaxe TS',ast.parseDiagnostics.length,0)
ok('Preserva guarda R426',source.includes('if (!dateIntent && tokens.length === 0) return []'))
ok('Preserva 13 tabelas',source.includes("const moreNames = ['tags', 'budgets', 'credit_invoices'] as const"))
const user='11111111-2222-4333-8444-555555555555';const dfl={user_id:user,context:'dfl'}
const objects={
 transactions:[{...dfl,id:'tx',description:'Bacon',amount:25,type:'expense',date:'2026-11-03',status:'done',category_id:'cat',account_id:'acc'}],
 accounts:[{...dfl,id:'acc',name:'Nubank',bank:'Nu Pagamentos',balance:500}],
 credit_cards:[{...dfl,id:'card',name:'Nubank Platinum'}],
 debts:[{...dfl,id:'debt',person_name:'Pedro',total_amount:150}],
 loans:[{...dfl,id:'loan',description:'Empréstimo Bruno',amount:100}],
 financings:[{...dfl,id:'fin',name:'Moto',asset:'XRE',total_amount:20000}],
 subscriptions:[{...dfl,id:'sub',name:'Netflix',amount:35}],
 goals:[{...dfl,id:'goal',name:'Viagem',target_amount:1000}],
 categories:[{...dfl,id:'cat',name:'Alimentação'}],
 contacts:[{...dfl,id:'contact',name:'João Gomes'}],
 tags:[{...dfl,id:'tag',name:'Manutenção'}],
 budgets:[{...dfl,id:'bud',name:'Reforma',category_id:'cat',amount:1000}],
 credit_invoices:[{...dfl,id:'inv',credit_card_id:'card',due_date:'2026-11-12',status:'open',total_amount:200,paid_amount:50}],
}
const readLog=[]
const db=Object.fromEntries(Object.entries(objects).map(([name,rows])=>[name,{
 where(idx){const expected=name==='credit_invoices'?'user_id':'[user_id+context]';eq('Indice de '+name,idx,expected)
 return {equals(value){const selected=rows.filter(r=>r.user_id===(Array.isArray(value)?value[0]:value) && (!Array.isArray(value)||r.context===value[1]));
 return {async toArray(){readLog.push(name);return selected},and(fn){return {async toArray(){readLog.push(name);return selected.filter(fn)}}}}
 }}}
}]))
const exp={}
new Function('require','exports',transpiled.outputText)(name=>{
 if(name==='@/lib/db')return {db}
 if(name==='@/lib/financialForecast')return {civilDate:v=>/^20\d{2}-\d{2}-\d{2}$/.test(String(v))}
 throw Error('Import nao permitido '+name)
},exp)
const check=async(q,expectedNames,expectedKind,expectedId)=>{
 readLog.length=0
 const results=await exp.searchFinancialData(user,'dfl',q)
 eq('Tabelas acessadas em '+q,readLog.slice().sort(),expectedNames.slice().sort())
 ok('Registro real '+q,results.some(x=>x.kind===expectedKind&&x.id===expectedId))
 return results
}
const set=exp.financialEntityReadSet
for(const [kind,names] of Object.entries({account:['accounts'],card:['credit_cards'],tag:['tags'],goal:['goals','categories'],budget:['budgets','categories'],contact:['contacts'],invoice:['credit_invoices','credit_cards'],financing:['financings'],loan:['loans']})){
 eq('Escopo '+kind,Array.from(set({kind,qualifier:''})).sort(),names.slice().sort())
}
eq('Qualificador conserva busca ampla',set({kind:'goal',qualifier:'viagem'}),null)
eq('Busca aberta conserva busca ampla',set(null),null)
eq('Tipo nao previsto conserva busca ampla',set({kind:'unknown',qualifier:''}),null)
await check('metas',['goals','categories'],'goal','goal')
await check('tags',['tags'],'tag','tag')
await check('orçamentos',['budgets','categories'],'budget','bud')
await check('faturas',['credit_cards','credit_invoices'],'invoice','inv')
await check('contatos',['contacts'],'contact','contact')
await check('contas',['accounts'],'account','acc')
await check('financiamentos',['financings'],'financing','fin')
await check('empréstimos',['loans'],'loan','loan')
const all=Object.keys(objects)
await check('Nubank',all,'account','acc')
await check('meta viagem',all,'goal','goal')
await check('abrir cartões do Nubank',all,'card','card')
readLog.length=0;eq('Comando vazio sem consulta',(await exp.searchFinancialData(user,'dfl','abrir')).length,0)
eq('Nenhuma leitura para comando vazio',readLog,[])
readLog.length=0
const pf=await exp.searchFinancialData(user,'personal','metas')
eq('Isolamento pessoal',pf.length,0)
readLog.length=0
const other=await exp.searchFinancialData('different-user','dfl','metas')
eq('Isolamento usuario',other.length,0)
const workflow=fs.readFileSync('.github/workflows/android-build.yml','utf8')
ok('R435 no CI',workflow.includes('node scripts/check-r435-universal-search.mjs'))
ok('R436 no CI',workflow.includes('node scripts/check-r436-search-scope.mjs'))
ok('Sem fetch ou Supabase no motor',!source.includes('fetch(')&&!source.includes('supabase'))
// R436-R2: Set.add deduplica resultados somente em memoria. Nao e db.add.
// A inspecao por AST barra mutacoes de dados e aceita SOMENTE o Set local
// comprovadamente inicializado para agrupar transferencias.
const declaredSets = new Set()
const visitSets = node => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) &&
      node.initializer && ts.isNewExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === 'Set') {
    declaredSets.add(node.name.text)
  }
  ts.forEachChild(node, visitSets)
}
visitSets(ast)
ok('Deduplicacao em memoria usa Set declarado', declaredSets.has('seenGroups'))
const writes = []
const writeMethods = new Set(['add', 'put', 'update', 'delete', 'clear', 'bulkAdd', 'bulkPut', 'bulkDelete', 'modify', 'bulkUpdate'])
const visitWrites = node => {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const method = node.expression.name.text
    if (writeMethods.has(method)) {
      const receiver = node.expression.expression
      // Unica excecao: conjunto local usado apenas no dedupe de transferencias.
      const safeSetAdd = method === 'add' && ts.isIdentifier(receiver) &&
        receiver.text === 'seenGroups' && declaredSets.has(receiver.text) &&
        node.arguments.length === 1 && ts.isPropertyAccessExpression(node.arguments[0]) &&
        ts.isIdentifier(node.arguments[0].expression) && node.arguments[0].expression.text === 'item' &&
        node.arguments[0].name.text === '_group'
      if (!safeSetAdd) writes.push(node.expression.getText(ast))
    }
  }
  ts.forEachChild(node, visitWrites)
}
visitWrites(ast)
eq('Sem escrita financeira no motor (AST)', writes, [])
console.log(`R436: ${passed} verificacoes de escopo, semantica, PF/PJ, regressao e CI aprovadas`)
