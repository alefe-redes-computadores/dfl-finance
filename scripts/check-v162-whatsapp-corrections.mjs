import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import assert from 'node:assert/strict'

const webhook = fs.readFileSync('supabase/functions/whatsapp-webhook/index.ts','utf8')
const start = webhook.indexOf('/* V162_CORRECTION_HELPERS_START')
const end = webhook.indexOf('/* V162_CORRECTION_HELPERS_END */')
assert.ok(start>=0&&end>start,'helper de correção íntegro')
const body = webhook.slice(start,end) + '\n;globalThis.testHelper={txCorrectionFocus,txCorrectionPatch,txCorrectionSegments};'
const transpiled=ts.transpileModule(body,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText
const ctx={
  N:s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(),
  amount:s=>{const m=String(s).match(/(?:r\$\s*)?(\d+(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:\.\d{1,2})?)/i);if(!m)return null;const v=Number(m[1].includes(',')?m[1].replaceAll('.','').replace(',','.'):m[1]);return Number.isFinite(v)&&v>0?v:null},
  explicitDate:s=>/17\/10/.test(s)?'2026-10-17':null,
  naturalDate:s=>/ontem/.test(s)?'2026-10-17':'2026-10-18',
};ctx.globalThis=ctx
vm.runInNewContext(transpiled,ctx,{timeout:3000})
const {txCorrectionFocus,txCorrectionPatch}=ctx.testHelper
const test=(label,ok)=>{assert.ok(ok,label);console.log('✓ '+label)}
const parse=(s,focus=null)=>JSON.parse(JSON.stringify(txCorrectionPatch(s,focus)))
test('corrigir nome reconhecido como intenção de descrição',txCorrectionFocus('Corrigir nome')==='description')
test('corrigir descrição é sinônimo',txCorrectionFocus('Quero corrigir descrição')==='description')
test('corrigir conta aponta conta',txCorrectionFocus('Corrigir conta')==='account')
test('nome livre depois de pergunta',parse('Vendas do dia 17','description').patch.description==='Vendas do dia 17')
test('edição de valor',parse('valor 35,90').patch.amount===35.9)
test('edição de descrição',parse('descrição Dipel').patch.description==='Dipel')
test('edição de data por linguagem natural',parse('foi ontem').patch.date==='2026-10-17')
test('edição de data explícita',parse('data 17/10').patch.date==='2026-10-17')
const multi=parse('Valor 300,00\nDe "Vendas"\nNa conta\nCarteira')
test('quatro linhas aceitam valor, nome e conta',multi.errors.length===0&&multi.patch.amount===300&&multi.patch.description==='Vendas'&&multi.patch.accountName==='Carteira')
const combo=parse('valor 300,00 e descrição Vendas e conta Carteira')
test('mensagem única separa três campos',combo.errors.length===0&&combo.fields.length===3)
test('sem valor válido interrompe operação',parse('valor abc').errors.length>0)
test('campo desconhecido não é descartado silenciosamente',parse('valor 300\nbanana extra').errors.length>0)
test('rascunho não chama RPC na etapa TX_CORRECT',!webhook.slice(webhook.indexOf('if(s?.step==="TX_CORRECT")'),webhook.indexOf('if(s?.step==="TX_SETTLE")')).includes('db.rpc('))
test('data do texto prevalece sobre data atual',webhook.includes('date:explicitDate(text)||naturalDate(text),provider_message_id:k'))
test('categoria sugerida não elimina descrição',webhook.includes('const semanticCat=ec;'))
test('confirmação explícita preservada',webhook.includes('await afterConfirm(u,phone,sd,reply,aid)'))
test('idempotência financeira preservada',webhook.includes('p_idempotency_key:key'))
test('comprovante e atualização de saldo preservados',webhook.includes('cleanupHeldReceipt')&&webhook.includes('bot_settle_transaction'))
console.log('V162 BRAIN CORRECTIONS: 18 verificações aprovadas')
