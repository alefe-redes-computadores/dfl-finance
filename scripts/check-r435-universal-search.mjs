import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read = p => fs.readFileSync(p,'utf8')
let checks = 0
const eq = (name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks++}
const ok = (name,actual)=>{assert.ok(actual,name);checks++}
const path='src/lib/globalSearch.ts'
const text=read(path)
const ast=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)
eq('R435 TypeScript sintaxe',ast.parseDiagnostics.length,0)
const transpiled=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.CommonJS},reportDiagnostics:true})
eq('R435 ES5 sem erros de transpilacao',transpiled.diagnostics?.length??0,0)
ok('R426: proteção original de consulta vazia mantida',text.includes('if (!dateIntent && tokens.length === 0) return []'))
ok('R435: busca por tipo explicitamente separada da guarda vazia',text.includes('if (!entity) {\n    if (!dateIntent && tokens.length === 0) return []\n  }'))
const uid='11111111-2222-4333-8444-555555555555'
const dfl={user_id:uid,context:'dfl'}
const pf={user_id:uid,context:'personal'}
const data={
  transactions:[
    {...dfl,id:'tx1',description:'Abastecimento',type:'expense',status:'done',date:'2026-11-03',amount:124,category_id:'cat1',account_id:'a1',tag_ids:['tag1'],receipt_url:'storage/receipt1'},
    {...dfl,id:'tx2',description:'Pagamento cartão',type:'expense',status:'done',date:'2026-11-03',amount:200,account_id:'a1',invoice_id:'inv1'},
    {...pf,id:'tx-private',description:'Abastecimento',type:'expense',date:'2026-11-03',amount:9999},
  ],
  accounts:[{...dfl,id:'a1',name:'Nubank',bank:'Nu Pagamentos',balance:500},{...pf,id:'apf',name:'Inter',balance:9999}],
  credit_cards:[{...dfl,id:'card1',name:'Nubank Platinum',institution:'Nubank',last_four:'1234'},{...pf,id:'cpf',name:'Inter'}],
  debts:[{...dfl,id:'debt1',person_name:'Maria',description:'Serviço',total_amount:350,status:'pending'}],
  loans:[{...dfl,id:'loan1',description:'Empréstimo Pedro',lender:'Banco Alpha',amount:1000}],
  financings:[{...dfl,id:'fin1',name:'Moto',asset:'XRE 300',bank:'Itaú',total_amount:30000,next_due_date:'2026-11-15'}],
  subscriptions:[{...dfl,id:'sub1',name:'Netflix',amount:35,next_due_date:'2026-11-10'}],
  goals:[{...dfl,id:'goal1',name:'Viagem',description:'Férias',target_amount:5000,deadline:'2026-11-25'}, {...dfl,id:'goal2',name:'Janeiro',description:'Reserva',target_amount:1000}],
  categories:[{...dfl,id:'cat1',name:'Alimentação',icon:'utensils',color:'#aaa'}],
  contacts:[{...dfl,id:'contact1',name:'João Gomes',company:'Empresa Delta',phone:'34999999999',type:'customer'}, {...pf,id:'pfcontact',name:'João Pessoal'}],
  tags:[{...dfl,id:'tag1',name:'Manutenção',color:'#3ff'}, {...pf,id:'pf-tag',name:'Segredo'}],
  budgets:[{...dfl,id:'bud1',name:'Reforma',category_id:'cat1',amount:2000,period:'monthly'}],
  credit_invoices:[{...dfl,id:'inv1',credit_card_id:'card1',total_amount:450,paid_amount:50,due_date:'2026-11-12',start_date:'2026-10-10',end_date:'2026-11-08',status:'open'}, {...pf,id:'inv-private',credit_card_id:'cpf',total_amount:99999,paid_amount:0,due_date:'2026-11-12',status:'open'}],
}
let reads=0
const db=Object.fromEntries(Object.entries(data).map(([name,rows])=>[name,{
  where(index){
    if(name==='credit_invoices')eq('Fatura consulta so usuario',index,'user_id')
    else eq('Indice usuario+contexto '+name,index,'[user_id+context]')
    return {equals(value){
      const selected=rows.filter(row=>Array.isArray(value)?row.user_id===value[0]&&row.context===value[1]:row.user_id===value)
      return {async toArray(){reads++;return selected},and(fn){return {async toArray(){reads++;return selected.filter(fn)}}}}
    }}
  },
}]))
const exports={}
new Function('require','exports',transpiled.outputText)((name)=>{
  if(name==='@/lib/db')return {db}
  if(name==='@/lib/financialForecast')return {civilDate:s=>/^20\d{2}-\d{2}-\d{2}$/.test(String(s))}
  throw Error('Import inesperado na busca: '+name)
},exports)
const find=(q,context='dfl',user=uid)=>exports.searchFinancialData(user,context,q)
const single=(q,kind,id)=>async()=>{
  const items=await find(q)
  ok(`Encontrou ${kind} para ${q}`,items.some(x=>x.kind===kind&&x.id===id))
  return items
}
for(const [q,k,id] of [
  ['metas','goal','goal1'],['meta viagem','goal','goal1'],['financiamentos','financing','fin1'],
  ['financiamento XRE','financing','fin1'],['conta Nubank','account','a1'],
  ['cartão Nubank','card','card1'],['categoria alimentação','category','cat1'],
  ['tags','tag','tag1'],['tag manutenção','tag','tag1'],['marcadores','tag','tag1'],
  ['orçamentos','budget','bud1'],['orçamento reforma','budget','bud1'],
  ['orçamento alimentação','budget','bud1'],['contatos','contact','contact1'],
  ['contato João','contact','contact1'],['cliente Empresa Delta','contact','contact1'],
  ['faturas','invoice','inv1'],['fatura Nubank','invoice','inv1'],
  ['emprestimo Pedro','loan','loan1'],['assinatura Netflix','subscription','sub1'],
  ['valores a receber','debt','debt1'],['divida Maria','debt','debt1'],
  ['comprovantes','transaction','tx1'],['metas em novembro','goal','goal1'],
  ['meta janeiro','goal','goal2'],
])await single(q,k,id)()

for(const [q,kind] of [
 ['metas','goal'],['financiamentos','financing'],['tags','tag'],['orcamentos','budget'],
 ['categorias','category'],['contatos','contact'],['faturas','invoice'],['emprestimos','loan'],
]) {
 const found=await find(q)
 ok(`Consulta por tipo nao mistura entidades: ${q}`,found.length>0&&found.every(v=>v.kind===kind))
}
const tagged=await find('manutenção')
ok('Tag associa transacao por tag_ids',tagged.some(x=>x.id==='tx1'&&x.kind==='transaction'))
const contact=await find('34999999999')
ok('Contato encontravel por telefone',contact.some(x=>x.kind==='contact'&&x.id==='contact1'))
const card=await find('1234')
ok('Cartao encontravel pelos quatro ultimos',card.some(x=>x.kind==='card'&&x.id==='card1'))
const invoice=await find('fatura Nubank')
eq('Fatura abre cartao cadastrado',invoice.find(x=>x.kind==='invoice')?.href,'/cards/details?id=card1')
eq('Fatura mostra valor restante, nao total bruto',invoice.find(x=>x.kind==='invoice')?.amount,400)
const tag=await find('tag manutenção')
eq('Tag abre pagina gerenciadora',tag.find(x=>x.kind==='tag')?.href,'/tags')
const budget=await find('orçamento reforma')
eq('Orcamento abre detalhe existente',budget.find(x=>x.kind==='budget')?.href,'/budgets/details?id=bud1')
const finance=await find('financiamento XRE')
eq('Financiamento abre detalhe existente',finance.find(x=>x.kind==='financing')?.href,'/financings/details?id=fin1')
const legacy=await find('abrir cartões do Nubank')
eq('R425: cartao antes da conta',legacy[0]?.id,'card1')
ok('R425: conta ainda aparece como resultado relacionado',legacy.some(x=>x.id==='a1'))
ok('Busca por periodo encontra transacao', (await find('novembro de 2026')).some(x=>x.id==='tx1'))
const noRead=reads
for(const q of ['abrir','buscar','abrir?'])eq(`Sem varredura para comando vazio ${q}`,(await find(q)).length,0)
eq('Comandos vazios nao consultam IndexedDB',reads,noRead)
for(const q of ['metas','tags','faturas','João', 'Nubank']) {
 eq(`Empresa nao vaza na Pessoal: ${q}`,(await find(q,'personal')).some(x=>x.context==='dfl'),false)
 eq(`Outro usuario sem vazamento: ${q}`,(await find(q,'dfl','unknown-user')).length,0)
}
eq('PF nao recebe tag empresarial',(await find('tag manutenção','personal')).length,0)
eq('PF nao recebe fatura empresarial',(await find('fatura Nubank','personal')).length,0)
const facetText=read('src/lib/financialSearchFacets.ts')
const facets={}
const tf=ts.transpileModule(facetText,{compilerOptions:{target:ts.ScriptTarget.ES5,module:ts.ModuleKind.CommonJS}})
new Function('require','exports',tf.outputText)(()=>({}),facets)
for(const kind of ['tag','budget','contact','invoice'])eq(`Faceta ${kind}`,facets.financialSearchFacet({kind}),kind)
ok('Facetas estao no UI', ['tag','budget','contact','invoice'].every(x=>read('src/app/(app)/search/page.tsx').includes(`id: '${x}'`)))
const uiColor = read('src/app/(app)/search/page.tsx')
eq('R435-R2: cor da tag nos tres pontos visuais', uiColor.split("item.categoryColor && (isTransaction || item.kind === 'category' || item.kind === 'tag')").length - 1, 3)
ok('Navegacao de todas novas areas', ['Tags','Orçamentos','Contatos','Financiamentos'].every(x=>read('src/lib/financialNavigationIntent.ts').includes(`label: '${x}'`)))
ok('Feedback de faltas preservado',read('src/app/(app)/search/page.tsx').includes('Não encontrei registros para esta frase'))
ok('R434 continua no CI',read('.github/workflows/android-build.yml').includes('node scripts/check-r434-demo-premium.mjs'))
ok('R435 entra no CI',read('.github/workflows/android-build.yml').includes('node scripts/check-r435-universal-search.mjs'))
ok('Sem escrita remota',!text.includes('supabase')&&!text.includes('fetch('))
console.log(`R435: ${checks} verificacoes de busca universal, entidades, relacoes, links, PF/PJ, UX e CI aprovadas`)
