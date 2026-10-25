import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const read=p=>fs.readFileSync(p,'utf8')
const pol='src/lib/premiumFieldPolicy.ts'
const out={}
new Function('exports',ts.transpileModule(read(pol),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText)(out)

const options=[
  {value:'1',label:'Saúde',description:'Tratamento'},
  {value:'2',label:'Salário',description:'Renda'},
  {value:'3',label:'Cartão',description:'Pagamento',disabled:true}
]

assert.deepEqual(
  out.searchPremiumOptions(options,'saude').map(x=>x.value),['1']
)
assert.deepEqual(
  out.searchPremiumOptions(options,'renda salario').map(x=>x.value),['2']
)
assert.deepEqual(
  out.searchPremiumOptions(options,'cartao').map(x=>x.value),['3']
)
assert.equal(out.searchPremiumOptions(options,'sem resultado').length,0)
assert.equal(out.searchPremiumOptions(options,'').length,3)
assert.equal(options[0].label,'Saúde')

assert.equal(out.validPremiumMoneyDigits('1'),true)
assert.equal(out.validPremiumMoneyDigits('123456789012345'),true)
assert.equal(out.validPremiumMoneyDigits('1234567890123456'),false)
assert.equal(out.validPremiumMoneyDigits('123a'),false)
assert.equal(out.validPremiumMoneyDigits(''),false)

const sel=read('src/components/SelectField.tsx')
const money=read('src/components/MoneyInput.tsx')
assert.ok(sel.includes('searchPremiumOptions(options, query)'))
assert.ok(sel.includes('visibleOptions.map((option)'))
assert.ok(sel.includes('options.length >= 10'))
assert.ok(money.includes('validPremiumMoneyDigits(raw)'))
assert.ok(sel.includes('aria-modal="true"'))

for(const p of [
  pol,
  'src/components/SelectField.tsx',
  'src/components/MoneyInput.tsx'
]){
  const ast=ts.createSourceFile(
    p,read(p),ts.ScriptTarget.Latest,true,
    p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS
  )
  assert.equal(ast.parseDiagnostics.length,0,p)
}
console.log('V224: contratos Premium aprovados.')
