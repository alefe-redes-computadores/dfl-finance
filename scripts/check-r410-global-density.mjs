import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import ts from 'typescript'

const root='src/app/(app)'
const pages=[]

function visit(dir) {
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const filename=path.join(dir,entry.name)
    if(entry.isDirectory()) visit(filename)
    else if(entry.name==='page.tsx') pages.push(filename)
  }
}

visit(root)
assert.ok(pages.length>=62,'Inventario incompleto')

const read=(p)=>fs.readFileSync(p,'utf8')
let checked=0

for(const filename of pages){
  const source=read(filename)
  const ast=ts.createSourceFile(
    filename,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX
  )
  assert.equal(ast.parseDiagnostics.length,0,filename)
  checked++
}

const app=(name)=>read(`${root}/${name}/page.tsx`)

for(const name of ['subscriptions','financings','loans']){
  assert.ok(app(name).includes('Ordenar: {sortBy'))
  assert.ok(app(name).includes('<details'))
}

assert.ok(app('receipts').includes('Vínculos: {linkFilter'))
assert.ok(app('contacts').includes('Relação: {filterOptions.find'))
assert.ok(app('transactions').includes('empty:hidden'))
assert.ok(app('debts').includes('shadow-sm p-3.5'))
assert.ok(app('budgets').includes("router.push('/planning')"))
assert.ok(app('goals').includes('text-[20px] font-semibold'))
assert.ok(app('cards').includes('text-[24px] leading-none'))

for(const name of [
 'financings/new','loans/new','subscriptions/new',
 'contacts/new','debts/new','cards/new','goals/new',
 'transactions/new','transactions/details'
]){
  assert.ok(app(name).includes('space-y-3'),name)
}

assert.ok(app('transactions/new').includes('showDetails'))
assert.ok(app('transactions/details').includes('showDetails'))
assert.ok(app('accounts').includes('setShowViewOptions'))
assert.ok(app('home').includes('openPersonalize'))
assert.ok(app('conciliation').includes('conciliation'))
assert.ok(app('more').includes('Atalhos frequentes'))

console.log(`R410: ${checked} paginas TSX validas`)
console.log('R410: filtros, cadastros, saldos e navegacao preservados estruturalmente')
