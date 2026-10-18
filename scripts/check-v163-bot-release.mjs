import fs from 'node:fs'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import ts from 'typescript'

const s = fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const between=(a,b)=>{
  const i=s.indexOf(a),j=s.indexOf(b,i+a.length)
  assert.ok(i>=0&&j>i,`bloco nao encontrado: ${a}`)
  return s.slice(i,j)
}
const helper=between('/* V162_CORRECTION_HELPERS_START','/* V162_CORRECTION_HELPERS_END */')
const source=helper+'\n;globalThis.verification={txCorrectionFocus,txCorrectionPatch,txCorrectionSegments};'
const transpiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const N=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
const amount=s=>{const m=String(s).match(/(?:r\$\s*)?(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/i);if(!m)return null;const n=Number(m[1].includes(',')?m[1].replaceAll('.','').replace(',','.'):m[1]);return n>0&&Number.isFinite(n)?n:null}
const c={N,amount,explicitDate:s=>/17\/10/.test(s)?'2026-10-17':null,naturalDate:s=>N(s).includes('ontem')?'2026-10-17':'2026-10-18'};c.globalThis=c
vm.runInNewContext(transpiled,c,{timeout:3000})
const {txCorrectionPatch,txCorrectionFocus}=c.verification
const parse=(text,focus=null)=>JSON.parse(JSON.stringify(txCorrectionPatch(text,focus)))
const checks=[
  ['nome no confirm pode ser corrigido sem menu',parse('nome Wesley').patch.description==='Wesley'],
  ['corrigir nome direto',parse('corrigir nome Wesley').patch.description==='Wesley'],
  ['valor direto',parse('valor 300,00').patch.amount===300],
  ['conta direta',parse('conta Carteira').patch.accountName==='Carteira'],
  ['data direta',parse('data 17/10').patch.date==='2026-10-17'],
  ['edicao multilinha preservada',parse('Valor 300,00\nDe "Vendas"\nNa conta\nCarteira').fields.length===3],
  ['correcao ambiguamente vazia recusa',parse('corrigir nome').errors.length>0],
  ['nome ou descricao reconhecido',txCorrectionFocus('Corrigir nome')==='description'],
  ['comando isolado de confirmacao nao e patch',parse('sim').fields.length===0],
  ['confirmacao explicita mantida',between('if(s?.step==="TX_CONFIRM")','if(s?.step==="TX_CORRECT")').includes('if(choice==="confirm")')],
  ['edicao direta cai em TX_CORRECT',between('if(s?.step==="TX_CONFIRM")','if(s?.step==="TX_CORRECT")').includes('s={...s,step:"TX_CORRECT"}')],
  ['sem RPC financeiro na confirmacao de correcao',!between('if(s?.step==="TX_CONFIRM")','if(s?.step==="TX_CORRECT")').includes('db.rpc(')],
  ['handler TX_CORRECT preserva confirmacao posterior',between('if(s?.step==="TX_CORRECT")','if(s?.step==="TX_SETTLE")').includes('await save(phone,"TX_CONFIRM",next)')],
  ['RPC idempotente preservado',s.includes('p_idempotency_key:key')],
  ['comprovante e transferencia preservados',s.includes('cleanupHeldReceipt')&&s.includes('bot_record_transfer')],
];
for(const [name,ok] of checks){console.log((ok?'OK':'ERRO')+': '+name);assert.ok(ok,name)}
console.log('V163 BOT: 15 contratos aprovados (sem chamadas a banco ou WhatsApp)')
