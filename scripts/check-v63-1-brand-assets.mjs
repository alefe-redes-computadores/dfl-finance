import fs from 'node:fs'
const r=fs.readFileSync('src/lib/bankRegistry.ts','utf8')
const i=fs.readFileSync('src/lib/BankIcons.tsx','utf8')
const checks=[
 ['Carteira registrada',r.includes("id: 'wallet'")&&r.includes("kind: 'wallet'")],
 ['Carteira usa desenho vetorial',i.includes("case 'wallet':")&&i.includes('<rect x="9" y="12" width="22" height="17" rx="4" />')],
 ['PagBank sem crop',r.includes("asset('/banks/pagbank.svg'")&&r.includes("h-[54%] w-[82%] object-contain")&&fs.existsSync('public/banks/pagbank.svg')],
 ['Stone sem crop',r.includes("asset('/banks/stone.svg'")&&r.includes("h-[52%] w-[80%] object-contain")&&fs.existsSync('public/banks/stone.svg')],
 ['PicPay preservado',fs.existsSync('public/banks/picpay.svg')],
 ['Mercado Pago preservado',fs.existsSync('public/banks/mercado-pago.svg')],
 ['iFood mark interno preservado',i.includes("case 'ifood':")&&!r.includes("asset('/banks/ifood-pago.svg'")],
 ['InfinitePay mark interno preservado',i.includes("case 'cloudwalk':")&&!r.includes("asset('/banks/infinitepay.svg'")],
 ['assets temporários removidos',!fs.existsSync('public/banks/ifood-pago.svg')&&!fs.existsSync('public/banks/infinitepay.svg')],
]
let fail=0
for(const [name,ok] of checks){console.log(`${ok?'OK ':'ERR'} ${name}`);if(!ok)fail++}
if(fail)process.exit(1)
console.log('\nV63.1 Brand Assets: OK')
