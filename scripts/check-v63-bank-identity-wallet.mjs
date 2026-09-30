import fs from 'node:fs'
const registry=fs.readFileSync('src/lib/bankRegistry.ts','utf8')
const icons=fs.readFileSync('src/lib/BankIcons.tsx','utf8')
const logo=fs.readFileSync('src/components/BankLogo.tsx','utf8')
const checks=[
 ['Carteira registrada',registry.includes("id: 'wallet'")&&registry.includes("kind: 'wallet'")],
 ['ícone de Carteira preservado',icons.includes("case 'wallet':")&&icons.includes('<rect x="9" y="12" width="22" height="17" rx="4" />')],
 ['Carteira não cai em iniciais',registry.includes("aliases: ['carteira', 'dinheiro'")&&logo.includes('hasBrandedBankIcon')],
 ['SVG iFood cadastrado',registry.includes("asset('/banks/ifood-pago.svg'")&&fs.existsSync('public/banks/ifood-pago.svg')],
 ['SVG InfinitePay cadastrado',registry.includes("asset('/banks/infinitepay.svg'")&&fs.existsSync('public/banks/infinitepay.svg')],
 ['SVG PagBank preservado',registry.includes("asset('/banks/pagbank.svg'")&&fs.existsSync('public/banks/pagbank.svg')],
 ['SVG Stone preservado',registry.includes("asset('/banks/stone.svg'")&&fs.existsSync('public/banks/stone.svg')],
 ['fallback desconhecido preservado',logo.includes('getFallbackLabel')],
]
let fail=0
for(const [n,ok] of checks){console.log(`${ok?'OK ':'ERR'} ${n}`);if(!ok)fail++}
if(fail)process.exit(1)
console.log('\nV63 Bank Identity + Carteira: OK')
