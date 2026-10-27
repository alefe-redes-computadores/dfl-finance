import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const s=fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const a=s.indexOf('/* V162_CORRECTION_HELPERS_START')
const b=s.indexOf('/* V162_CORRECTION_HELPERS_END */',a)
assert.ok(a>=0 && b>a)
const js=ts.transpileModule(s.slice(a,b)+'\n;globalThis.r121=txCorrectionPatch;',{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText
const N=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
const amount=s=>{const m=String(s).match(/(?:r\$\s*)?(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/i);if(!m)return null;const raw=m[1];const v=Number(raw.includes(',')?raw.replaceAll('.','').replace(',','.'):raw);return Number.isFinite(v)&&v>0?v:null}
const c={N,amount,explicitDate:()=>null,naturalDate:()=> '2026-10-25'};c.globalThis=c
vm.runInNewContext(js,c,{timeout:2000})
const parse=s=>JSON.parse(JSON.stringify(c.r121(s)))
const checks=[
 ['correcao natural de conta',parse('na verdade foi no Inter').patch.accountName==='Inter'],
 ['correcao sem introducao',parse('foi no Nubank').patch.accountName==='Nubank'],
 ['correcao natural de valor',parse('era 79,90').patch.amount===79.9],
 ['correcao com moeda',parse('na verdade era R$ 87,90').patch.amount===87.9],
 ['valor explicito antigo',parse('valor 300,00').patch.amount===300],
 ['conta explicita antiga',parse('conta Carteira').patch.accountName==='Carteira'],
 ['sem adivinhar texto solto',parse('na verdade').errors.length>0],
 ['sem aceitar zero',parse('era 0').errors.length>0],
 ['sem RPC dentro do helper',!s.slice(a,b).includes('db.rpc(')],
 ['confirmacao financeira conservada',s.includes('if(choice==="confirm"){\n    await afterConfirm(u,phone,sd,reply,aid)')],
 ['registro idempotente conservado',s.includes('p_idempotency_key:key')],
 ['inbox revisao mantida',fs.readFileSync('src/lib/inboxPolicy.ts','utf8').includes("'whatsapp'")]
]
for(const [label,passed] of checks){assert.ok(passed,label);console.log('OK:',label)}
console.log('R121 — 12 contratos aprovados')
